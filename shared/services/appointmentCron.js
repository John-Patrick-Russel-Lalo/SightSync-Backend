import cron from "node-cron";
import pool from "../config/db.js";
import { APP_TIMEZONE, nowWallClock, formatWallClockDateTime } from "../utils/dateTime.js";
import { sendNotification } from "../../modules/notification/notification.service.js";

// Moves every expired 'scheduled' appointment into the archive as 'no_show' and
// frees up its time slot.
//
// The source appointment id travels into appointment_archive.source_appointment_id
// instead of being read back off the archive's own SERIAL id: the archive id is a
// different number, so deleting by it used to leave the expired appointment sitting
// in appointments, which made this job re-archive and re-notify it every minute.
//
// That column also carries a unique index, so a booking can only be archived once.
// The ON CONFLICT below turns a repeat attempt (an overlapping tick, a second
// server instance, or an admin marking it manually) into zero returned rows, which
// is what makes the notification fire exactly once per appointment.
export async function archiveExpiredNoShows(client, currentWallClock) {
    const archived = await client.query(
        `
        WITH expired AS (
            DELETE FROM appointments
            WHERE status = 'scheduled'
              AND end_time < $1::timestamp
            RETURNING id, doctor_id, patient_id, start_time, end_time, notes, created_at,
                      payment_proof, payment_proof_mime, payment_proof_filename,
                      consultation_fee, payment_amount, payment_status,
                      payment_rejection_reason, payment_verified_by, payment_verified_at
        )
        INSERT INTO appointment_archive (
            source_appointment_id,
            doctor_id, patient_id, start_time, end_time, notes, status, created_at, updated_at,
            payment_proof, payment_proof_mime, payment_proof_filename,
            consultation_fee, payment_amount, payment_status,
            payment_rejection_reason, payment_verified_by, payment_verified_at
        )
        SELECT id, doctor_id, patient_id, start_time, end_time, notes, 'no_show', created_at, CURRENT_TIMESTAMP,
               payment_proof, payment_proof_mime, payment_proof_filename,
               consultation_fee, payment_amount, payment_status,
               payment_rejection_reason, payment_verified_by, payment_verified_at
        FROM expired
        ON CONFLICT (source_appointment_id) WHERE source_appointment_id IS NOT NULL DO NOTHING
        RETURNING source_appointment_id, patient_id, doctor_id, start_time
        `,
        [currentWallClock]
    );

    return archived.rows;
}

export function startAppointmentCron() {
    // Runs every 5 minutes: '*/5 * * * *'
    cron.schedule("*/1 * * * *", async () => {
        const client = await pool.connect();
        let expiredRows = [];
        try {
            await client.query("BEGIN");

            // end_time is a timezone-less wall clock value while NOW() resolves in
            // the database session timezone. Comparing them directly expires
            // appointments hours early, so resolve "now" on the clinic clock.
            const currentWallClock = nowWallClock(APP_TIMEZONE);

            expiredRows = await archiveExpiredNoShows(client, currentWallClock);

            if (expiredRows.length > 0) {
                console.log(`[CRON] Archived ${expiredRows.length} expired appointments as 'no_show'.`);
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("[CRON Error] Failed to archive expired appointments:", error);
            return;
        } finally {
            client.release();
        }

        // Notify only after the transaction is committed so a push never goes out
        // for a run that ended up rolled back. Only rows this run actually moved
        // out of 'scheduled' are here, so the notification is sent once.
        for (const row of expiredRows) {
            const startTime = formatWallClockDateTime(row.start_time);
            try {
                await sendNotification(row.patient_id, "Appointment No-Show", `Your appointment for ${startTime} was marked as a no-show.`);
                await sendNotification(row.doctor_id, "Appointment No-Show", `The appointment for patient ID: ${row.patient_id} at ${startTime} was marked as a no-show.`);
            } catch (notifErr) {
                console.error("[CRON] Failed to send no-show notification:", notifErr);
            }
        }
    }, { timezone: APP_TIMEZONE });
}
