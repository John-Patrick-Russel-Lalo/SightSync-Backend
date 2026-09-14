import cron from "node-cron";
import pool from "../config/db.js";

export function startAppointmentCron() {
    // Runs every 5 minutes: '*/5 * * * *'
    cron.schedule("*/1 * * * *", async () => {
        try {
            const result = await pool.query(`
                UPDATE appointments
                SET status = 'no_show',
                    updated_at = CURRENT_TIMESTAMP
                WHERE status = 'scheduled'
                  AND end_time < NOW()
                RETURNING id;
            `);

            if (result.rowCount > 0) {
                console.log(`[CRON] Updated ${result.rowCount} expired appointments to 'no_show'.`);
            }
        } catch (error) {
            console.error("[CRON Error] Failed to update expired appointments:", error);
        }
    });
}