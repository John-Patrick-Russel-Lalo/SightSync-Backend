import { describe, expect, it } from "vitest";
import { isWithinConsultationStartWindow } from "./consultationTiming.js";

describe("consultation start window", () => {
  const appointment = {
    startTime: "2026-11-08 10:00:00",
    endTime: "2026-11-08 10:30:00",
  };

  it("allows a start up to 30 minutes before the appointment", () => {
    expect(
      isWithinConsultationStartWindow({
        ...appointment,
        currentTime: "2026-11-08 09:30:00",
      }),
    ).toBe(true);
  });

  it("allows an on-time start and a start up to 30 minutes after the scheduled end", () => {
    expect(
      isWithinConsultationStartWindow({
        ...appointment,
        currentTime: "2026-11-08 10:00:00",
      }),
    ).toBe(true);
    expect(
      isWithinConsultationStartWindow({
        ...appointment,
        currentTime: "2026-11-08 11:00:00",
      }),
    ).toBe(true);
  });

  it("rejects starts outside the early or late grace periods", () => {
    expect(
      isWithinConsultationStartWindow({
        ...appointment,
        currentTime: "2026-11-08 09:29:59",
      }),
    ).toBe(false);
    expect(
      isWithinConsultationStartWindow({
        ...appointment,
        currentTime: "2026-11-08 11:00:01",
      }),
    ).toBe(false);
  });

  it("fails closed for malformed or invalid appointment timestamps", () => {
    expect(
      isWithinConsultationStartWindow({
        startTime: "not-a-time",
        endTime: "2026-11-08 10:30:00",
        currentTime: "2026-11-08 10:00:00",
      }),
    ).toBe(false);
  });
});
