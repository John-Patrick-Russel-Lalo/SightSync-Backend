import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pool from "../../shared/config/db.js";
import { notifyPatientAppointment, sendAppointmentEmail } from "./appointmentEmail.service.js";

vi.mock("../../shared/config/db.js", () => ({ default: { query: vi.fn() } }));

describe("appointment notifications", () => {
    beforeEach(() => {
        vi.stubEnv("BREVO_API_KEY", "test-key");
        vi.stubEnv("BREVO_SENDER_EMAIL", "clinic@example.com");
        vi.stubEnv("BREVO_SENDER_NAME", "SightSync");
        pool.query.mockResolvedValue({ rows: [{ email: "patient@example.com" }] });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: "test-id" }) }));
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("sends the patient a transactional email using Brevo", async () => {
        await sendAppointmentEmail(5, "Appointment Approved", "Your request was approved.");
        expect(pool.query).toHaveBeenCalledWith(expect.any(String), [5]);
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe("https://api.brevo.com/v3/smtp/email");
        expect(options.headers["api-key"]).toBe("test-key");
        expect(JSON.parse(options.body)).toMatchObject({
            sender: { email: "clinic@example.com", name: "SightSync" },
            to: [{ email: "patient@example.com" }],
            subject: "SightSync: Appointment Approved",
            textContent: expect.stringContaining("Your request was approved."),
        });
    });

    it("still sends the web notification when Brevo fails", async () => {
        fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
        const web = vi.fn().mockResolvedValue({ id: 1 });
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        await notifyPatientAppointment(5, "Appointment Requested", "Request received.", web);
        expect(web).toHaveBeenCalledWith(5, "Appointment Requested", "Request received.");
        expect(log).toHaveBeenCalled();
    });

    it("still attempts email when the web notification fails", async () => {
        const web = vi.fn().mockRejectedValue(new Error("database error"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        await notifyPatientAppointment(5, "Appointment Approved", "Approved.", web);
        expect(fetch).toHaveBeenCalledOnce();
    });
});
