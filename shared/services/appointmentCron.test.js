import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveExpiredNoShows } from "./appointmentCron.js";

vi.mock("../config/db.js", () => ({
    default: { query: vi.fn(), connect: vi.fn() },
}));

vi.mock("../../modules/notification/notification.service.js", () => ({
    sendNotification: vi.fn(),
}));

const NOW = "2026-09-01 10:00:00";

function mockClient(rows) {
    return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe("archiveExpiredNoShows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the expired appointments so the caller can notify them once", async () => {
        const expired = [
            { source_appointment_id: 11, patient_id: 2, doctor_id: 1, start_time: "2026-09-01 08:00:00" },
            { source_appointment_id: 12, patient_id: 3, doctor_id: 1, start_time: "2026-09-01 08:30:00" },
        ];
        const client = mockClient(expired);

        const rows = await archiveExpiredNoShows(client, NOW);

        expect(rows).toEqual(expired);
        expect(client.query).toHaveBeenCalledTimes(1);
    });

    it("returns nothing when the appointment was already archived", async () => {
        // ON CONFLICT DO NOTHING drops the repeat entry, so this run has no
        // transitions to announce and the notification is not sent again.
        const client = mockClient([]);

        const rows = await archiveExpiredNoShows(client, NOW);

        expect(rows).toEqual([]);
    });

    it("removes the expired appointment itself instead of trusting the archive id", async () => {
        const client = mockClient([]);
        await archiveExpiredNoShows(client, NOW);

        const [sql, params] = client.query.mock.calls[0];

        // The appointment must be deleted by the same statement that archives it:
        // appointment_archive.id is its own SERIAL, so deleting by a RETURNING id
        // from the insert would target an unrelated (usually non-existent) row and
        // leave the expired appointment behind to be archived again next run.
        expect(sql).toMatch(/DELETE FROM appointments/i);
        expect(sql).toMatch(/status = 'scheduled'/);
        expect(sql).toMatch(/RETURNING id, doctor_id, patient_id/i);

        // The archive row carries the source id, which is also what the caller
        // reports on - not the archive's own id.
        expect(sql).toMatch(/source_appointment_id/i);
        expect(sql).toMatch(/RETURNING source_appointment_id, patient_id, doctor_id, start_time/i);
        expect(sql).not.toMatch(/RETURNING\s+id,\s*patient_id/i);

        expect(params).toEqual([NOW]);
    });

    it("guards the insert with ON CONFLICT so an appointment can only be archived once", async () => {
        const client = mockClient([]);
        await archiveExpiredNoShows(client, NOW);

        const [sql] = client.query.mock.calls[0];

        expect(sql).toMatch(/ON CONFLICT \(source_appointment_id\)/);
        expect(sql).toMatch(/DO NOTHING/);
    });

    it("carries the payment proof into the archive like the manual path does", async () => {
        const client = mockClient([]);
        await archiveExpiredNoShows(client, NOW);

        const [sql] = client.query.mock.calls[0];

        for (const column of [
            "payment_proof",
            "payment_proof_mime",
            "payment_proof_filename",
            "consultation_fee",
            "payment_amount",
            "payment_status",
            "payment_rejection_reason",
            "payment_verified_by",
            "payment_verified_at",
        ]) {
            expect(sql).toMatch(new RegExp(column));
        }
    });
});
