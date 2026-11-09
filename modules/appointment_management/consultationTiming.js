import { parseWallClock } from "../../shared/utils/dateTime.js";

// A consultation may be started a little early or late without allowing a
// future appointment to make the doctor appear busy for the rest of the day.
export const CONSULTATION_START_EARLY_MINUTES = 30;
export const CONSULTATION_START_LATE_MINUTES = 30;

/**
 * Returns whether the current clinic wall-clock time is inside the allowed
 * consultation-start window. All inputs are naive clinic timestamps.
 */
export function isWithinConsultationStartWindow({
  startTime,
  endTime,
  currentTime,
}) {
  const start = parseWallClock(startTime);
  const end = parseWallClock(endTime);
  const now = parseWallClock(currentTime);

  if (!start || !end || !now || end < start) return false;

  const earliestStart = new Date(
    start.getTime() - CONSULTATION_START_EARLY_MINUTES * 60 * 1000,
  );
  const latestStart = new Date(
    end.getTime() + CONSULTATION_START_LATE_MINUTES * 60 * 1000,
  );

  return now >= earliestStart && now <= latestStart;
}
