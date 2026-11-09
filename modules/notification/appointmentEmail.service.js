import pool from "../../shared/config/db.js";

// Email failures must never undo an appointment that has already been saved.
export async function sendAppointmentEmail(userId, subject, detail) {
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_API;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    if (!apiKey || !senderEmail) throw new Error("Brevo email is not configured");

    const { rows } = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
    const email = rows[0]?.email?.trim();
    if (!email) throw new Error("Patient has no email address");

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || "SightSync" },
            to: [{ email }],
            subject: `SightSync: ${subject}`,
            textContent: `${detail}\n\nPlease sign in to SightSync to view your appointment.`,
        }),
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Brevo request failed (HTTP ${response.status})`);
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
