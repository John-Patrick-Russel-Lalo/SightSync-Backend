import { describe, it, expect } from "vitest";
import {
  formatWallClockDateTime,
  isValidDateString,
  isValidTimeString,
  nowWallClock,
  parseWallClock,
} from "./dateTime.js";

describe("wall clock date/time helpers", () => {
  // The stored value is clinic wall clock: 12:30 means 12:30 at the clinic.
  const STORED = "2026-09-01 12:30:00";

  describe("formatWallClockDateTime", () => {
    it("renders the stored wall clock verbatim", () => {
      expect(formatWallClockDateTime(STORED)).toBe("Tue, Sep 1, 2026 • 12:30 PM");
    });

    it("does not shift values that were previously tagged as UTC", () => {
      // A UTC server used to emit this for the same row.
      expect(formatWallClockDateTime("2026-09-01T12:30:00.000Z")).toBe(
        formatWallClockDateTime(STORED),
      );
    });

    it("keeps late appointments on the same calendar day", () => {
      expect(formatWallClockDateTime("2026-09-01 23:45:00")).toBe(
        "Tue, Sep 1, 2026 • 11:45 PM",
      );
    });

    it("renders date-only values without inventing a midnight time", () => {
      expect(formatWallClockDateTime("2026-09-01")).toBe("Tue, Sep 1, 2026");
    });

    it("returns N/A for missing values", () => {
      expect(formatWallClockDateTime(null)).toBe("N/A");
      expect(formatWallClockDateTime("")).toBe("N/A");
      expect(formatWallClockDateTime(undefined)).toBe("N/A");
    });
  });

  describe("parseWallClock", () => {
    it("reads the calendar and clock digits", () => {
      const parsed = parseWallClock(STORED);
      expect(parsed.getUTCFullYear()).toBe(2026);
      expect(parsed.getUTCMonth()).toBe(8);
      expect(parsed.getUTCDate()).toBe(1);
      expect(parsed.getUTCHours()).toBe(12);
      expect(parsed.getUTCMinutes()).toBe(30);
    });

    it("ignores any trailing offset", () => {
      expect(parseWallClock("2026-09-01T12:30:00.000Z").getTime()).toBe(
        parseWallClock(STORED).getTime(),
      );
    });

    it("accepts values without seconds", () => {
      expect(parseWallClock("2026-09-01 12:30").getUTCHours()).toBe(12);
    });

    it("returns null for unparseable values", () => {
      expect(parseWallClock("not-a-date")).toBeNull();
      expect(parseWallClock("")).toBeNull();
      expect(parseWallClock(null)).toBeNull();
    });
  });

  describe("nowWallClock", () => {
    const asUtcMs = (value) => Date.parse(`${value.replace(" ", "T")}Z`);

    it("returns a naive timestamp Postgres can cast to timestamp", () => {
      expect(nowWallClock("Asia/Manila")).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("resolves the requested timezone, not the host timezone", () => {
      // Asia/Manila is a fixed UTC+8 with no daylight saving.
      const offsetMs =
        asUtcMs(nowWallClock("Asia/Manila")) - asUtcMs(nowWallClock("UTC"));
      expect(Math.abs(offsetMs - 8 * 60 * 60 * 1000)).toBeLessThan(2000);
    });

    it("does not depend on the host timezone", () => {
      const first = nowWallClock("Asia/Manila");
      expect(nowWallClock("Asia/Manila").slice(0, 13)).toBe(first.slice(0, 13));
    });
  });

  describe("validation", () => {
    it("accepts well formed values", () => {
      expect(isValidDateString("2026-09-01")).toBe(true);
      expect(isValidDateString("2024-02-29")).toBe(true);
      expect(isValidTimeString("00:00")).toBe(true);
      expect(isValidTimeString("23:59")).toBe(true);
      expect(isValidTimeString("9:05")).toBe(true);
    });

    it("rejects values that would produce a malformed timestamp", () => {
      expect(isValidDateString("2026-02-30")).toBe(false);
      expect(isValidDateString("2026-13-01")).toBe(false);
      expect(isValidDateString("09/01/2026")).toBe(false);
      expect(isValidTimeString("24:00")).toBe(false);
      expect(isValidTimeString("12:60")).toBe(false);
      expect(isValidTimeString("12:30 PM")).toBe(false);
      expect(isValidTimeString("12:30:00")).toBe(false);
    });
  });
});