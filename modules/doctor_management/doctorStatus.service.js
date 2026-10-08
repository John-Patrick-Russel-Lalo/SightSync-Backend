// Realtime doctor presence.
//
// The doctor side already flips between "Available" and "In Consultation" as
// the clock moves through scheduled appointment windows or a consultation is
// marked ongoing. This module computes the same state server-side so patients
// can see it live through the websocket instead of re-deriving it locally.
//
// A doctor is considered "in_consultation" when there is an appointment today
// that is marked as ongoing, or a scheduled appointment whose wall-clock window
// (start_time .. end_time) contains "now". Everything else is "available".
import pool from "../../shared/config/db.js";
import { nowWallClock, APP_TIMEZONE } from "../../shared/utils/dateTime.js";
import { emitToAll } from "../../shared/realtime/bus.js";

/** @type {Map<string, string>} last status pushed per doctor (userId -> status) */
const lastStatuses = new Map();

/**
 * Reads every doctor's current presence from the appointments table. Returns an
 * array of `{ doctorId, status }` where `status` is "in_consultation" or
 * "available".
 */
export async function getDoctorStatuses() {
    const currentWallClock = nowWallClock(APP_TIMEZONE);
    const today = currentWallClock.slice(0, 10);

    const result = await pool.query(
        `
        SELECT
            dp.user_id AS doctor_id,
            EXISTS (
                SELECT 1
                FROM appointments a
                WHERE a.doctor_id = dp.user_id
                  AND (
                      (a.status = 'in_consultation' AND a.start_time::date = $2::date)
                      OR
                      (a.status = 'scheduled'
                       AND a.start_time <= $1::timestamp
                       AND a.end_time >= $1::timestamp)
                  )
            ) AS in_consultation
        FROM doctor_profiles dp
        ORDER BY dp.user_id
        `,
        [currentWallClock, today]
    );

    return result.rows.map((row) => ({
        doctorId: String(row.doctor_id),
        status: row.in_consultation ? "in_consultation" : "available",
    }));
}

/**
 * Recomputes doctor presence and pushes a `doctor:status` event for every
 * doctor whose status actually changed. Returns the emitted changes.
 */
export async function broadcastDoctorStatusChanges() {
    let statuses;
    try {
        statuses = await getDoctorStatuses();
    } catch (error) {
        console.error("Failed to compute doctor statuses:", error);
        return [];
    }

    const changes = [];
    for (const { doctorId, status } of statuses) {
        if (lastStatuses.get(doctorId) === status) continue;

        lastStatuses.set(doctorId, status);
        emitToAll("doctor:status", { doctorId, status });
        changes.push({ doctorId, status });
    }

    return changes;
}

/**
 * Fresh `{ [doctorId]: status }` map for the snapshot pushed to a socket the
 * moment it connects, so the patient sees statuses without waiting for a tick.
 */
export async function getDoctorStatusSnapshot() {
    const statuses = await getDoctorStatuses();
    return Object.fromEntries(statuses.map(({ doctorId, status }) => [doctorId, status]));
}

/**
 * Recomputes presence on a timer so the patient side follows the same automatic
 * Available -> In Consultation -> Available flip as the clock moves, even when
 * no appointment row changes. Returns a stop function for tests.
 */
export function startDoctorStatusBroadcast(intervalMs = 30000) {
    const timer = setInterval(broadcastDoctorStatusChanges, intervalMs);
    if (typeof timer.unref === "function") timer.unref();
    return () => clearInterval(timer);
}