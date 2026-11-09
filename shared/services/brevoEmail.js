export async function sendBrevoEmail(email, subject, textContent) {
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_API;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    if (!apiKey || !senderEmail) throw new Error("Brevo email is not configured");

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || "SightSync" },
            to: [{ email }],
            subject: `SightSync: ${subject}`,
            textContent,
        }),
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Brevo request failed (HTTP ${response.status}): ${body.message || "Unknown error"}`);
    }
    return response.json();
}
