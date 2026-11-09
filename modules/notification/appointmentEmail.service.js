import pool from "../../shared/config/db.js";
import { sendBrevoEmail } from "../../shared/services/brevoEmail.js";

// Email failures must never undo an appointment that has already been saved.
export async function sendAppointmentEmail(userId, subject, detail) {
    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    const email = rows[0]?.email?.trim();
    if (!email) throw new Error("Patient has no email address");

    return sendBrevoEmail(email, subject, `${detail}\n\nPlease sign in to SightSync to view your appointment.`);
}

export async function notifyPatientAppointment(userId, title, detail, sendWebNotification) {
    const results = await Promise.allSettled([
        sendWebNotification(userId, title, detail),
        sendAppointmentEmail(userId, title, detail),
    ]);
    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
            console.error(`Patient appointment ${index === 0 ? "web notification" : "email"} failed:`, result.reason?.message || "Unknown error");
        }
    }
}
