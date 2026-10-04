/**
 * Clinic appointment times are stored as PostgreSQL TIMESTAMP WITHOUT TIME ZONE,
 * i.e. they are "wall clock" values with no timezone attached (12:30 means 12:30
 * at the clinic). They must never be shifted by the server's timezone, because the
 * production host (Render) runs in UTC while development machines run in the
 * clinic's timezone.
 *
 * These helpers treat every appointment timestamp as a floating wall clock value.
 */

/** IANA timezone the clinic operates in. Used to resolve "now" only. */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

/** Wall clock values are formatted verbatim, so pin the formatter to UTC. */
const WALL_CLOCK_TZ = "UTC";

const WALL_CLOCK_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Parses a timestamp string into a Date whose UTC fields match the stored wall
 * clock. Formatting that Date with `timeZone: "UTC"` therefore reproduces the
 * original value exactly, regardless of the server timezone.
 *
 * Any trailing offset (e.g. "Z" or "+08:00") is intentionally ignored: the digits
 * are the clinic wall clock, which keeps responses stable even if a row was read
 * by an older server that tagged it as UTC.
 *
 * @param {string | Date | null | undefined} value
 * @returns {Date | null}
 */
export function parseWallClock(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const match = WALL_CLOCK_PATTERN.exec(String(value).trim());
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
}

/**
 * Human readable wall clock rendering, e.g. "Mon, Sep 1, 2026 • 12:30 PM".
 * Deterministic regardless of where the server runs. Values without a time
 * component render as the date alone rather than inventing a midnight time.
 *
 * @param {string | Date | null | undefined} value
 * @param {string} [locale]
 * @returns {string}
 */
export function formatWallClockDateTime(value, locale = "en-US") {
  if (value === null || value === undefined || value === "") return "N/A";

  const date = parseWallClock(value);
  if (!date) return "N/A";

  const formattedDate = date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: WALL_CLOCK_TZ,
  });

  if (!/\d{1,2}:\d{2}/.test(String(value))) return formattedDate;

  const formattedTime = date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: WALL_CLOCK_TZ,
  });

  return `${formattedDate} • ${formattedTime}`;
}

/**
 * Current time in the clinic timezone, formatted as a naive wall clock string so
 * it can be compared against TIMESTAMP WITHOUT TIME ZONE columns.
 *
 * @param {string} [timeZone]
 * @returns {string} e.g. "2026-09-01 12:30:00"
 */
export function nowWallClock(timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const lookup = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }

  // Intl renders midnight as "24" in some engines; normalise it to "00".
  const hour = lookup.hour === "24" ? "00" : lookup.hour;

  return `${lookup.year}-${lookup.month}-${lookup.day} ${hour}:${lookup.minute}:${lookup.second}`;
}

/** True when `value` is a valid `YYYY-MM-DD` calendar date. */
export function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseWallClock(value);
  if (!date) return false;
  return toDateString(date) === value;
}

/** True when `value` is a valid 24-hour `HH:MM` time string. */
export function isValidTimeString(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/** `Date` -> `YYYY-MM-DD` using UTC fields (pair with `parseWallClock`). */
function toDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}