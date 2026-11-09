import "dotenv/config";
import validator from "validator";
import { sendBrevoEmail } from "../shared/services/brevoEmail.js";

const recipient = process.argv[2]?.trim();
if (!recipient || !validator.isEmail(recipient)) {
    console.error("Usage: npm run test:email -- recipient@example.com");
    process.exitCode = 1;
} else {
    try {
        const result = await sendBrevoEmail(recipient, "Test email", "This is a test of SightSync appointment email notifications.");
        console.log(`Brevo accepted the test email. Message ID: ${result.messageId || "not provided"}`);
        console.log("Acceptance does not guarantee delivery; check the inbox and spam folder.");
    } catch (error) {
        console.error(`Test email failed: ${error.message}`);
        process.exitCode = 1;
    }
}
