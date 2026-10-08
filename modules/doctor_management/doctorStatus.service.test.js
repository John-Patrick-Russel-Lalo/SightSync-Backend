import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../shared/config/db.js", () => ({
    default: { query: vi.fn() },
}));

vi.mock("../../shared/realtime/bus.js", () => ({
    emitToAll: vi.fn(),
}));

// Re-import the module per test so the in-memory baseline cache starts empty.
async function loadModule() {
    vi.resetModules();
    const db = (await import("../../shared/config/db.js")).default;
    const { emitToAll } = await import("../../shared/realtime/bus.js");
    const service = await import("./doctorStatus.service.js");
    return { db, emitToAll, service };
}

describe("Doctor Status Service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("maps query rows into doctorId/status pairs", async () => {
        const { db, service } = await loadModule();
        db.query.mockResolvedValueOnce({
            rows: [
                { doctor_id: "1", in_consultation: true },
                { doctor_id: "2", in_consultation: false },
            ],
        });

        const statuses = await service.getDoctorStatuses();

        expect(statuses).toEqual([
            { doctorId: "1", status: "in_consultation" },
            { doctorId: "2", status: "available" },
        ]);
    });

    it("returns a fresh doctorId -> status map from the snapshot", async () => {
        const { db, service } = await loadModule();
        db.query.mockResolvedValueOnce({
            rows: [
                { doctor_id: "1", in_consultation: true },
                { doctor_id: "2", in_consultation: false },
            ],
        });

        const snapshot = await service.getDoctorStatusSnapshot();

        expect(snapshot).toEqual({ "1": "in_consultation", "2": "available" });
    });

    it("emits a doctor:status event only when a doctor's status changes", async () => {
        const { db, emitToAll, service } = await loadModule();

        db.query.mockResolvedValueOnce({
            rows: [
                { doctor_id: "1", in_consultation: false },
                { doctor_id: "2", in_consultation: false },
            ],
        });
        let changes = await service.broadcastDoctorStatusChanges();
        expect(changes).toEqual([
            { doctorId: "1", status: "available" },
            { doctorId: "2", status: "available" },
        ]);
        expect(emitToAll).toHaveBeenCalledWith("doctor:status", {
            doctorId: "1",
            status: "available",
        });

        db.query.mockResolvedValueOnce({
            rows: [
                { doctor_id: "1", in_consultation: false },
                { doctor_id: "2", in_consultation: false },
            ],
        });
        emitToAll.mockClear();
        changes = await service.broadcastDoctorStatusChanges();
        expect(changes).toEqual([]);
        expect(emitToAll).not.toHaveBeenCalled();

        db.query.mockResolvedValueOnce({
            rows: [
                { doctor_id: "1", in_consultation: true },
                { doctor_id: "2", in_consultation: false },
            ],
        });
        changes = await service.broadcastDoctorStatusChanges();
        expect(changes).toEqual([{ doctorId: "1", status: "in_consultation" }]);
        expect(emitToAll).toHaveBeenLastCalledWith("doctor:status", {
            doctorId: "1",
            status: "in_consultation",
        });
    });

    it("returns no changes when the status query fails", async () => {
        const { db, emitToAll, service } = await loadModule();
        db.query.mockRejectedValueOnce(new Error("db down"));

        const changes = await service.broadcastDoctorStatusChanges();

        expect(changes).toEqual([]);
        expect(emitToAll).not.toHaveBeenCalled();
    });
});