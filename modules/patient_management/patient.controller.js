import * as PatientModel from "./patient.model.js";
import { phoneNumberValidator } from "./patient.service.js";
import { generateSummary } from "../ai/ai.service.js";

// GET /patients/:patientId/report
// Aggregates a single patient's profile, full appointment history, and
// consultation notes into one report for admins and doctors.
export async function handleGetPatientReport(req, res) {
    try {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json({ error: "Patient ID is required." });
        }

        const report = await PatientModel.getPatientReport(patientId);

        if (!report.patient) {
            return res.status(404).json({ error: "Patient not found." });
        }

        return res.status(200).json({ success: true, data: report });
    } catch (error) {
        console.error("Error generating patient report:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Turns the structured report into a plain-language prompt for the AI summary
// module (generateSummary already strips the input down to a single paragraph).
function buildReportOverviewPrompt(report) {
    const patient = report.patient || {};
    const summary = report.summary || {};
    const notes = report.notes || [];
    const appointments = report.appointments || [];

    const lines = [
        "You are assisting staff at an optometry clinic. Write a short clinical overview of a patient based on the report data below.",
        "Use ONLY the facts given. Do not invent, diagnose, or recommend treatment.",
        "",
        `Patient: ${[patient.display_name, patient.username].filter(Boolean).join(" ") || "N/A"}`,
    ];
    if (patient.gender) lines.push(`Gender: ${patient.gender}`);
    if (patient.date_of_birth) lines.push(`Date of birth: ${patient.date_of_birth}`);
    if (patient.blood_type) lines.push(`Blood type: ${patient.blood_type}`);
    lines.push(`Total appointments: ${summary.totalAppointments ?? 0}`);
    lines.push(`Completed appointments: ${summary.completedAppointments ?? 0}`);
    lines.push(`Cancelled/declined/no-show appointments: ${summary.cancelledAppointments ?? 0}`);
    lines.push(`Pending appointments: ${summary.pendingAppointments ?? 0}`);
    lines.push(`Consultation notes on file: ${summary.consultationNotes ?? 0}`);
    lines.push(`Last visit: ${summary.lastVisit || "None"}${summary.lastVisitDoctor ? ` (with ${summary.lastVisitDoctor})` : ""}`);
    lines.push(`Total paid: PHP ${summary.totalPaid ?? 0}`);

    if (notes.length > 0) {
        lines.push("", "Recent consultation notes (latest first):");
        for (const note of notes.slice(0, 5)) {
            lines.push(`- ${note.doctor_name || "Doctor"} (${note.created_at || "date unknown"}): ${String(note.note).slice(0, 300)}`);
        }
    } else {
        lines.push("", "No consultation notes on file.");
    }

    if (appointments.length > 0) {
        lines.push("", "Appointment history (latest first):");
        for (const appointment of appointments.slice(0, 8)) {
            const appointmentNotes = appointment.notes ? ` - "${String(appointment.notes).slice(0, 150)}"` : "";
            lines.push(`- ${appointment.status || "unknown"} (${appointment.start_time || "date unknown"}) with ${appointment.doctor_name || "doctor"}${appointmentNotes}`);
        }
    }

    lines.push(
        "",
        "Return a single concise overview paragraph (3-5 sentences) covering who the patient is, visit and appointment history, payments and attendance, key clinical concerns from the notes, and any notable patterns."
    );

    return lines.join("\n");
}

// One generated overview per patient per week: within this window the stored
// copy is served instead of paying for another model call.
const REPORT_SUMMARY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function summarizeAvailability(latest) {
    if (!latest?.generated_at) {
        return { latest, fresh: false, nextAvailableAt: null };
    }
    const generatedAt = new Date(latest.generated_at).getTime();
    const nextAvailableAt = new Date(generatedAt + REPORT_SUMMARY_COOLDOWN_MS);
    const fresh = Number.isFinite(generatedAt) && nextAvailableAt.getTime() > Date.now();
    return { latest, fresh, nextAvailableAt };
}

// GET /patients/:patientId/report/summary
// Read-only lookup of the stored weekly overview. Returns a null summary when
// none exists yet or the previous one has expired, so the client can tell the
// user whether "Generate" will call the model.
export async function handleGetPatientReportSummary(req, res) {
    try {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json({ error: "Patient ID is required." });
        }

        const latest = await PatientModel.getLatestPatientReportSummary(patientId);
        const { fresh, nextAvailableAt } = summarizeAvailability(latest);

        return res.status(200).json({
            success: true,
            summary: fresh ? latest.summary : null,
            generatedAt: fresh ? latest.generated_at : null,
            nextAvailableAt: fresh ? nextAvailableAt.toISOString() : null,
            cached: fresh,
        });
    } catch (error) {
        console.error("Error loading patient report summary:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// POST /patients/:patientId/report/summary
// Generates the overview, but only when the stored one is older than a week;
// otherwise the stored copy is returned untouched (cached: true).
export async function handlePostPatientReportSummary(req, res) {
    try {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json({ error: "Patient ID is required." });
        }

        const existing = await PatientModel.getLatestPatientReportSummary(patientId);
        const availability = summarizeAvailability(existing);

        if (availability.fresh) {
            return res.status(200).json({
                success: true,
                summary: existing.summary,
                generatedAt: existing.generated_at,
                nextAvailableAt: availability.nextAvailableAt.toISOString(),
                cached: true,
            });
        }

        const report = await PatientModel.getPatientReport(patientId);

        if (!report.patient) {
            return res.status(404).json({ error: "Patient not found." });
        }

        const summary = await generateSummary(buildReportOverviewPrompt(report));
        const nextAvailableAt = new Date(Date.now() + REPORT_SUMMARY_COOLDOWN_MS);

        let stored = null;
        try {
            stored = await PatientModel.insertPatientReportSummary(
                patientId,
                summary,
                req.user?.id ?? null
            );
        } catch (storeError) {
            // Never lose a generated summary just because the tracking table
            // is missing (patient_report_summaries.sql not run yet).
            console.error("Could not store patient report summary:", storeError);
        }

        return res.status(200).json({
            success: true,
            summary,
            generatedAt: stored?.generated_at || new Date().toISOString(),
            nextAvailableAt: nextAvailableAt.toISOString(),
            cached: false,
        });
    } catch (error) {
        console.error("Error generating patient report summary:", error);
        const isAiUnavailable =
            error?.message === "AI provider or API key is not configured." ||
            error?.message === "Unable to generate summary at this time.";
        return res.status(isAiUnavailable ? 503 : 500).json({
            error: isAiUnavailable
                ? "The AI overview service is temporarily unavailable. Please try again later."
                : "Internal Server Error"
        });
    }
}

// GET /api/patient/me
export async function getMyProfile(req, res) {
    try {
        // Assume req.user.id is populated by your authentication middleware
        const userId = req.user.id; 
        
        const profile = await PatientModel.getPatientProfileByUserId(userId);

        if (!profile) {
            return res.status(404).json({ message: "Patient profile not found." });
        }

        return res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve profile.", 
            error: error.message 
        });
    }
}

export async function getPatientProfileByPatientId(req, res) {
    try {
        const { patientId } = req.params;

        if (!patientId) {
            return res.status(400).json({ message: "Patient ID is required." });
        }

        const profile = await PatientModel.getPatientProfileByUserId(patientId);

        if (!profile) {
            return res.status(404).json({ message: "Patient profile not found." });
        }

        return res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve profile.", 
            error: error.message 
        });
    }
}

export async function updateMyPatientProfile(req, res, next) {
    try {
        const userId = req.user.id;

        const isAdmin = req.user.role === "admin";
        console.log(isAdmin)

        phoneNumberValidator(req, res);

        const updatedProfile = await PatientModel.updatePatientProfileByUser(
            userId,
            req.body,
            isAdmin
        );

        return res.status(200).json({
            message: "Patient profile updated successfully.",
            data: updatedProfile
        });
    } catch (error) {
        next(error);
    }
}

// PUT /api/patient/me
export async function updateProfile(req, res) {
    try {
        const userId = req.body.id;

        if (!userId) {
            return res.status(400).json({ success: false, message: "Patient id is required." });
        }

        // Stop here when the validator already rejected the payload, otherwise
        // the controller would try to write a second response.
        await phoneNumberValidator(req, res);
        if (res.headersSent) return;

        
        const updatedProfile = await PatientModel.updatePatientProfile(userId, req.body);

        if (!updatedProfile) {
            return res.status(404).json({ message: "Patient profile update failed. Profile not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Patient profile updated successfully.",
            data: updatedProfile
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Failed to update profile.", 
            error: error.message 
        });
    }
}


export async function updatePatientStatusController(req, res) {
    try {
        const { patientId, status } = req.body;

        if (!patientId || !status) {
            return res.status(400).json({ message: "Patient ID and status are required." });
        }

        const updatedProfile = await PatientModel.updatePatientStatus(patientId, status);

        if (!updatedProfile) {
            return res.status(404).json({ message: "Patient profile update failed. Profile not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Patient status updated successfully.",
            data: updatedProfile
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Failed to update patient status.", 
            error: error.message 
        });
    }
}