import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./patient.model.js", () => ({
    getLatestPatientReportSummary: vi.fn(),
    getPatientReport: vi.fn(),
    insertPatientReportSummary: vi.fn(),
}));

vi.mock("../ai/ai.service.js", () => ({
    generateSummary: vi.fn(),
}));

import {
    handleGetPatientReportSummary,
    handlePostPatientReportSummary,
} from "./patient.controller.js";
import {
    getLatestPatientReportSummary,
    getPatientReport,
    insertPatientReportSummary,
} from "./patient.model.js";
import { generateSummary } from "../ai/ai.service.js";

const DAYS = 24 * 60 * 60 * 1000;

const storedSummary = (ageDays) => ({
    id: 11,
    summary: "Stored overview text.",
    generated_by: 3,
    generated_at: new Date(Date.now() - ageDays * DAYS).toISOString(),
});

const report = {
    patient: { user_id: 7, display_name: "Sample Patient" },
    appointments: [],
    notes: [],
    summary: {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        pendingAppointments: 0,
        consultationNotes: 0,
        lastVisit: null,
        lastVisitDoctor: null,
        totalPaid: 0,
    },
};

function makeReq() {
    return { params: { patientId: "7" }, user: { id: 3 } };
}

function makeRes() {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
}

describe("Patient report summary (weekly limit)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GET serves a fresh stored summary without calling the model", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(storedSummary(2));

        const res = makeRes();
        await handleGetPatientReportSummary(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.summary).toBe("Stored overview text.");
        expect(body.cached).toBe(true);
        expect(body.nextAvailableAt).toBeTruthy();
        expect(generateSummary).not.toHaveBeenCalled();
    });

    it("GET reports no summary once the stored one is older than a week", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(storedSummary(8));

        const res = makeRes();
        await handleGetPatientReportSummary(makeReq(), res);

        const body = res.json.mock.calls[0][0];
        expect(body.summary).toBeNull();
        expect(body.cached).toBe(false);
        expect(body.nextAvailableAt).toBeNull();
    });

    it("GET reports no summary when none was ever generated", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(null);

        const res = makeRes();
        await handleGetPatientReportSummary(makeReq(), res);

        const body = res.json.mock.calls[0][0];
        expect(body.summary).toBeNull();
        expect(body.cached).toBe(false);
    });

    it("POST returns the stored copy instead of generating twice in one week", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(storedSummary(1));

        const res = makeRes();
        await handlePostPatientReportSummary(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.summary).toBe("Stored overview text.");
        expect(body.cached).toBe(true);
        expect(generateSummary).not.toHaveBeenCalled();
        expect(insertPatientReportSummary).not.toHaveBeenCalled();
        expect(getPatientReport).not.toHaveBeenCalled();
    });

    it("POST generates and stores a new summary when none exists yet", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(null);
        getPatientReport.mockResolvedValueOnce(report);
        generateSummary.mockResolvedValueOnce("Fresh overview text.");
        insertPatientReportSummary.mockResolvedValueOnce({
            id: 12,
            generated_at: new Date().toISOString(),
        });

        const res = makeRes();
        await handlePostPatientReportSummary(makeReq(), res);

        expect(generateSummary).toHaveBeenCalledTimes(1);
        expect(insertPatientReportSummary).toHaveBeenCalledWith(
            "7",
            "Fresh overview text.",
            3
        );
        const body = res.json.mock.calls[0][0];
        expect(body.summary).toBe("Fresh overview text.");
        expect(body.cached).toBe(false);
        expect(body.nextAvailableAt).toBeTruthy();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("POST regenerates after the week has passed", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(storedSummary(8));
        getPatientReport.mockResolvedValueOnce(report);
        generateSummary.mockResolvedValueOnce("Rebuilt overview text.");
        insertPatientReportSummary.mockResolvedValueOnce({
            id: 13,
            generated_at: new Date().toISOString(),
        });

        const res = makeRes();
        await handlePostPatientReportSummary(makeReq(), res);

        expect(generateSummary).toHaveBeenCalledTimes(1);
        expect(insertPatientReportSummary).toHaveBeenCalledWith(
            "7",
            "Rebuilt overview text.",
            3
        );
        expect(res.json.mock.calls[0][0].cached).toBe(false);
    });

    it("POST keeps the generated summary when storing fails", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(null);
        getPatientReport.mockResolvedValueOnce(report);
        generateSummary.mockResolvedValueOnce("Fresh overview text.");
        insertPatientReportSummary.mockRejectedValueOnce(new Error("relation does not exist"));

        const res = makeRes();
        await handlePostPatientReportSummary(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].summary).toBe("Fresh overview text.");
    });

    it("POST maps AI outages to a 503 and does not store anything", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(null);
        getPatientReport.mockResolvedValueOnce(report);
        generateSummary.mockRejectedValueOnce(
            new Error("Unable to generate summary at this time.")
        );

        const res = makeRes();
        await handlePostPatientReportSummary(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(insertPatientReportSummary).not.toHaveBeenCalled();
    });

    it("POST 404s for a patient that does not exist", async () => {
        getLatestPatientReportSummary.mockResolvedValueOnce(null);
        getPatientReport.mockResolvedValueOnce({ patient: null, appointments: [], notes: [], summary: {} });

        const res = makeRes();
        await handlePostPatientReportSummary(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(generateSummary).not.toHaveBeenCalled();
    });
});
