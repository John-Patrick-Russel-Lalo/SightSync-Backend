import cron from "node-cron";
import pool from "../config/db.js";
import { APP_TIMEZONE, nowWallClock } from "../utils/dateTime.js";

export function startAppointmentCron() {
    // Runs every 5 minutes: '*/5 * * * *'
    cron.schedule("*/1 * * * *", async () => {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            // end_time is a timezone-less wall clock value while NOW() resolves in
            // the database session timezone. Comparing them directly expires
            // appointments hours early, so resolve "now" on the clinic clock.
            const currentWallClock = nowWallClock(APP_TIMEZONE);

            // Move expired scheduled appointments to the archive as 'no_show'
            // so their time slots become available again.
            const archived = await client.query(`
                INSERT INTO appointment_archive (
                    doctor_id, patient_id, start_time, end_time, notes, status, created_at, updated_at
                )
                SELECT doctor_id, patient_id, start_time, end_time, notes, 'no_show', created_at, CURRENT_TIMESTAMP
                FROM appointments
                WHERE status = 'scheduled'
                  AND end_time < $1::timestamp
                RETURNING id;
            `, [currentWallClock]);

            if (archived.rowCount > 0) {
                const archivedIds = archived.rows.map((row) => row.id);
                await client.query(
                    `DELETE FROM appointments WHERE id = ANY($1::int[])`,
                    [archivedIds]
                );
                console.log(`[CRON] Archived ${archived.rowCount} expired appointments as 'no_show'.`);
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("[CRON Error] Failed to archive expired appointments:", error);
        } finally {
            client.release();
        }
    }, { timezone: APP_TIMEZONE });
}