import { describe, it, expect, vi, beforeEach } from "vitest";
import pool from "../../shared/config/db.js";
import { getAvailableSlots, createAppointment } from "./appointment.service.js";

// Mock the db module
vi.mock("../../shared/config/db.js", () => {
  const queryMock = vi.fn();
  const connectMock = vi.fn();
  return {
    default: {
      query: queryMock,
      connect: connectMock,
    },
  };
});

describe("Appointment Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAvailableSlots", () => {
    it("should return empty array if doctor profile does not exist", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const slots = await getAvailableSlots(1, "2026-09-01");
      expect(slots).toEqual([]);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it("should return empty array if doctor schedule override marks as unavailable", async () => {
      // 1. Doctor Profile query
      pool.query.mockResolvedValueOnce({
        rows: [{ slot_duration_minutes: 30 }],
      });
      // 2. Override query returns is_unavailable = true
      pool.query.mockResolvedValueOnce({
        rows: [{ is_unavailable: true }],
      });

      const slots = await getAvailableSlots(1, "2026-09-01");
      expect(slots).toEqual([]);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it("should generate available slots using override schedule when provided", async () => {
      // 1. Doctor Profile
      pool.query.mockResolvedValueOnce({
        rows: [{ slot_duration_minutes: 30 }],
      });
      // 2. Override query returns custom shift 09:00 - 10:30
      pool.query.mockResolvedValueOnce({
        rows: [{ start_time: "09:00", end_time: "10:30", is_unavailable: false }],
      });
      // 3. Booked appointments query (1 slot booked 09:30 - 10:00)
      pool.query.mockResolvedValueOnce({
        rows: [{ start_time: "09:30", end_time: "10:00" }],
      });

      const slots = await getAvailableSlots(1, "2026-09-01");
      
      // 09:00-09:30 (Available), 09:30-10:00 (Booked), 10:00-10:30 (Available)
      expect(slots).toEqual(["09:00", "10:00"]);
    });

    it("should fallback to regular schedule when no override exists", async () => {
      // 1. Doctor Profile
      pool.query.mockResolvedValueOnce({
        rows: [{ slot_duration_minutes: 30 }],
      });
      // 2. Override query returns no rows
      pool.query.mockResolvedValueOnce({ rows: [] });
      // 3. Regular schedule query returns weekly shift 09:00 - 10:00
      pool.query.mockResolvedValueOnce({
        rows: [{ start_time: "09:00", end_time: "10:00" }],
      });
      // 4. Booked appointments query (No booked appointments)
      pool.query.mockResolvedValueOnce({ rows: [] });

      const slots = await getAvailableSlots(1, "2026-09-01");
      expect(slots).toEqual(["09:00", "09:30"]);
    });
  });

  describe("createAppointment", () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      pool.connect.mockResolvedValue(mockClient);
    });

    it("should return 400 if doctor profile is not found", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Doctor profile check

      const result = await createAppointment({
        doctorId: 1,
        patientId: 2,
        date: "2026-09-01",
        slot: "09:00",
        notes: "Checkup",
      });

      expect(result).toEqual({
        success: false,
        statusCode: 400,
        message: "Doctor profile for user_id 1 does not exist.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should return 400 if requested slot falls outside shift hours", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ slot_duration_minutes: 30 }] }) // Doctor profile
        .mockResolvedValueOnce({ rows: [] }) // Override query
        .mockResolvedValueOnce({
          rows: [{ start_time: "09:00", end_time: "12:00" }],
        }); // Weekly schedule (Shift ends at 12:00)

      // Request slot at 12:00 (ends at 12:30, which is outside shift)
      const result = await createAppointment({
        doctorId: 1,
        patientId: 2,
        date: "2026-09-01",
        slot: "12:00",
      });

      expect(result).toEqual({
        success: false,
        statusCode: 400,
        message: "The requested time slot falls outside the doctor's working hours.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should return 409 if time slot conflicts with an existing booking", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ slot_duration_minutes: 30 }] }) // Doctor profile
        .mockResolvedValueOnce({ rows: [] }) // Override query
        .mockResolvedValueOnce({
          rows: [{ start_time: "09:00", end_time: "12:00" }],
        }) // Regular schedule
        .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // Conflict check returns existing appt

      const result = await createAppointment({
        doctorId: 1,
        patientId: 2,
        date: "2026-09-01",
        slot: "09:00",
      });

      expect(result).toEqual({
        success: false,
        statusCode: 409,
        message: "This slot is no longer available. Please select another time.",
      });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should successfully create appointment and commit transaction", async () => {
      const mockCreatedAppt = {
        id: 10,
        doctor_id: 1,
        patient_id: 2,
        start_time: "2026-09-01 09:00:00",
        end_time: "2026-09-01 09:30:00",
        status: "scheduled",
        notes: "Routine checkup",
        created_at: "2026-08-22 10:00:00",
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ slot_duration_minutes: 30 }] }) // Doctor profile
        .mockResolvedValueOnce({ rows: [] }) // Override query
        .mockResolvedValueOnce({
          rows: [{ start_time: "09:00", end_time: "12:00" }],
        }) // Regular schedule
        .mockResolvedValueOnce({ rows: [] }) // Conflict check passes (0 conflicts)
        .mockResolvedValueOnce({ rows: [mockCreatedAppt] }); // INSERT returning row

      const result = await createAppointment({
        doctorId: 1,
        patientId: 2,
        date: "2026-09-01",
        slot: "09:00",
        notes: "Routine checkup",
      });

      expect(result).toEqual({
        success: true,
        statusCode: 201,
        data: mockCreatedAppt,
      });
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback transaction and release client on thrown error", async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error("Database connection failure"));

      await expect(
        createAppointment({
          doctorId: 1,
          patientId: 2,
          date: "2026-09-01",
          slot: "09:00",
        })
      ).rejects.toThrow("Database connection failure");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});