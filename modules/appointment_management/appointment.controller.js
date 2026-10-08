import { getAvailableSlots, createAppointment, getAllAppointments, getAppointmentByDoctorId, getAppointmentByPatientId, updateAppointmentStatus, getAppointmentById, getAppointmentPaymentProof, updateAppointmentPaymentStatus, archiveAppointment, getArchivedAppointments, getArchivedAppointmentsByUser, createConsultationNote, getConsultationNotesByAppointment, getConsultationNotesByPatient } from "./appointment.service.js";
import { sendNotification } from "../notification/notification.service.js";
import { getUsersByRole } from "../users/users.model.js";
import { broadcastDoctorStatusChanges } from "../doctor_management/doctorStatus.service.js";
import { formatWallClockDateTime, isValidDateString, isValidTimeString } from "../../shared/utils/dateTime.js";

export async function handleGetAvailableSlots(req, res) {
    try {
        const { doctorId, date } = req.params;

        if (!doctorId || !date) {
            return res.status(400).json({
                error: "doctorId path parameter and 'date' query parameter (YYYY-MM-DD) are required."
            });
        }

        const slots = await getAvailableSlots(doctorId, date);
        return res.json({ doctorId, date, availableSlots: slots });
    } catch (error) {
        console.error("Error fetching available slots:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleGetAllAppointments(req, res) {
    try {
        const appointments = await getAllAppointments();
        return res.json({ appointments });
    } catch (error) {
        console.error("Error fetching all appointments:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleGetAppointmentByDoctorId(req, res) {
    try {
        const { doctorId } = req.params;

        if (!doctorId) {
            return res.status(400).json({
                error: "doctorId path parameter is required."
            });
        }

        const appointments = await getAppointmentByDoctorId(doctorId);
        return res.json({ doctorId, appointments });
    } catch (error) {
        console.error("Error fetching appointments by doctor:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleGetAppointmentByPatientId(req, res) {
    try {
        const patientId = req.user.id;

        const appointments = await getAppointmentByPatientId(patientId);
        return res.json({ patientId, appointments });
    } catch (error) {
        console.error("Error fetching appointments by patient:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleGetArchivedAppointments(req, res) {
    try {
        const archives = await getArchivedAppointments();
        return res.json({ archives });
    } catch (error) {
        console.error("Error fetching archived appointments:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleGetArchivedAppointmentsForCurrentUser(req, res) {
    try {
        const userId = req.user.id;
        const archives = await getArchivedAppointmentsByUser(userId);
        return res.json({ userId, archives });
    } catch (error) {
        console.error("Error fetching archived appointments for user:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleCreateAppointment(req, res) {
    try {
        const { doctorId, patientId, date, slot, notes } = req.body;

        if (!doctorId || !patientId || !date || !slot) {
            return res.status(400).json({
                error: "doctorId, patientId, date (YYYY-MM-DD), and slot (HH:MM) are required."
            });
        }

        if (!isValidDateString(date) || !isValidTimeString(slot)) {
            return res.status(400).json({
                error: "Invalid date or time slot. Expected date as YYYY-MM-DD and slot as HH:MM (24-hour)."
            });
        }

        const result = await createAppointment({
            doctorId,
            patientId,
            date,
            slot,
            notes
        });

        if (!result.success) {
            return res.status(result.statusCode).json({ error: result.message });
        }

        // Send Notifications
        try {
            await sendNotification(patientId, "Appointment Requested", `Your appointment request for ${date} at ${slot} has been submitted and is pending admin approval.`);
            await sendNotification(doctorId, "New Appointment Request", `A new appointment request has been submitted by patient ID: ${patientId} for ${date} at ${slot}.`);
            
            const admins = await getUsersByRole('admin');
            for (const admin of admins) {
                await sendNotification(admin.id, "Pending Appointment Approval", `New appointment request from patient ID: ${patientId} for doctor ID: ${doctorId} requires your approval.`);
            }
        } catch (notifErr) {
            console.error("Failed to send notifications:", notifErr);
        }

        return res.status(201).json({
            message: "Appointment successfully created.",
            appointment: result.data
        });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: "Invalid doctorId or patientId. The specified user does not exist." 
            });
        }
        console.error("Error creating appointment:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export async function handleCreateAppointmentByPatient(req, res) {
    try {
        const { doctorId, date, slot, notes } = req.body;
        const patientId = req.user.id;

        if (!doctorId || !patientId || !date || !slot) {
            return res.status(400).json({
                error: "doctorId, date (YYYY-MM-DD), and slot (HH:MM) are required."
            });
        }

        if (!isValidDateString(date) || !isValidTimeString(slot)) {
            return res.status(400).json({
                error: "Invalid date or time slot. Expected date as YYYY-MM-DD and slot as HH:MM (24-hour)."
            });
        }

        // Patients pay half of the consultation fee up front, so the booking
        // cannot be created without proof of that payment.
        if (!req.file) {
            return res.status(400).json({
                error: "A photo or screenshot of your half-payment is required to request an appointment."
            });
        }

        const result = await createAppointment({
            doctorId,
            patientId,
            date,
            slot,
            notes,
            paymentProof: req.file
        });

        if (!result.success) {
            return res.status(result.statusCode).json({ error: result.message });
        }

        const amountPaid = Number(result.data.payment_amount) || 0;

        // Send Notifications
        try {
            await sendNotification(patientId, "Appointment Requested", `Your appointment request for ${date} at ${slot} with your half-payment of PHP ${amountPaid.toFixed(2)} has been submitted and is pending admin review of your payment proof.`);
            await sendNotification(doctorId, "New Appointment Request", `A new appointment request has been submitted by patient ID: ${patientId} for ${date} at ${slot}.`);

            const admins = await getUsersByRole('admin');
            for (const admin of admins) {
                await sendNotification(admin.id, "Pending Appointment Approval", `New appointment request from patient ID: ${patientId} for doctor ID: ${doctorId} requires your approval. Their half-payment proof of PHP ${amountPaid.toFixed(2)} must be reviewed first.`);
            }
        } catch (notifErr) {
            console.error("Failed to send notifications:", notifErr);
        }

        return res.status(201).json({
            message: "Appointment successfully created. Your half-payment proof is now awaiting admin review.",
            appointment: result.data
        });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ 
                error: "Invalid doctorId or patientId. The specified user does not exist." 
            });
        }
        console.error("Error creating appointment:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Streams the payment-proof image. The proof is private, so it is never exposed
// as a static file: admins can read any proof, everyone else only their own.
export async function handleGetPaymentProof(req, res) {
    try {
        const { id } = req.params;

        const proof = await getAppointmentPaymentProof(id);

        if (!proof) {
            return res.status(404).json({ error: "No payment proof was uploaded for this appointment." });
        }

        const isAdmin = req.user.role === "admin";
        const isOwner = proof.patient_id === req.user.id || proof.doctor_id === req.user.id;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: "Forbidden: You cannot view this payment proof." });
        }

        res.setHeader("Content-Type", proof.mime);
        res.setHeader("Content-Length", proof.buffer.length);
        res.setHeader("Cache-Control", "private, no-store");
        return res.send(proof.buffer);
    } catch (error) {
        console.error("Error fetching payment proof:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

const PAYMENT_VERIFICATION_ACTIONS = {
    verify: "verified",
    reject: "rejected"
};

// Admin decision on a submitted payment proof. Only a verified proof unlocks
// the Approve button.
export async function handleUpdatePaymentVerification(req, res) {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        const nextStatus = PAYMENT_VERIFICATION_ACTIONS[action];
        if (!nextStatus) {
            return res.status(400).json({ error: "Invalid action provided. Expected 'verify' or 'reject'." });
        }

        const appointment = await getAppointmentById(id);
        if (!appointment) {
            return res.status(404).json({ error: "Appointment not found." });
        }

        if (!appointment.has_payment_proof) {
            return res.status(400).json({ error: "This appointment has no payment proof to review." });
        }

        if (appointment.payment_status === nextStatus) {
            return res.status(409).json({
                error: `This payment proof has already been ${nextStatus}.`
            });
        }

        const updatedAppointment = await updateAppointmentPaymentStatus(id, {
            status: nextStatus,
            verifiedBy: req.user.id,
            rejectionReason: nextStatus === "rejected"
                ? (reason?.trim() || "Payment proof was rejected by the administrator.")
                : null
        });

        // Send notifications based on the admin's decision
        try {
            const startTime = formatWallClockDateTime(appointment.start_time);

            if (nextStatus === "verified") {
                await sendNotification(appointment.patient_id, "Payment Verified", `Your half-payment proof for the appointment on ${startTime} has been verified. The appointment is now awaiting final approval.`);
            } else {
                await sendNotification(appointment.patient_id, "Payment Proof Rejected", `Your half-payment proof for the appointment on ${startTime} was rejected: ${updatedAppointment.payment_rejection_reason}`);
            }
        } catch (notifErr) {
            console.error("Failed to send payment verification notifications:", notifErr);
        }

        return res.json({
            message: nextStatus === "verified"
                ? "Payment proof verified. The appointment can now be approved."
                : "Payment proof rejected.",
            appointment: updatedAppointment
        });
    } catch (error) {
        console.error("Error updating payment verification:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Statuses a doctor may set on their own appointment: mark the consultation as
// ongoing when it starts and completed when it finishes. Everything else
// (approval, declines, cancellation, no-show) stays with the admin.
const DOCTOR_STATUS_VALUES = ['in_consultation', 'completed'];

// Which current status each doctor-driven transition is allowed from, so an
// appointment that was cancelled or never approved cannot be started.
const DOCTOR_ALLOWED_FROM = {
    in_consultation: ['scheduled'],
    completed: ['scheduled', 'in_consultation']
};

// Terminal statuses: the row is moved out of appointments into
// appointment_archive (history) instead of being updated in place.
const ARCHIVED_STATUS_VALUES = ['declined', 'no_show', 'cancelled', 'completed'];

export async function handleUpdateAppointmentStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['scheduled', 'declined', 'cancelled', 'completed', 'no_show', 'in_consultation'].includes(status)) {
            return res.status(400).json({ error: "Invalid status provided." });
        }

        const appointment = await getAppointmentById(id);
        if (!appointment) {
            return res.status(404).json({ error: "Appointment not found." });
        }

        const isAdmin = req.user.role === "admin";

        if (!isAdmin) {
            // Doctors may only update their own appointments, and only between
            // the consultation states (ongoing / completed).
            if (appointment.doctor_id !== req.user.id) {
                return res.status(403).json({ error: "Forbidden: You can only update your own appointments." });
            }

            if (!DOCTOR_STATUS_VALUES.includes(status)) {
                return res.status(403).json({
                    error: "Doctors can only mark an appointment as in consultation or completed."
                });
            }

            const allowedFrom = DOCTOR_ALLOWED_FROM[status] || [];
            if (!allowedFrom.includes(appointment.status)) {
                return res.status(409).json({
                    error: `An appointment with status "${appointment.status}" cannot be marked as "${status}".`
                });
            }
        }

        // Appointments booked by a patient carry a half-payment proof that an
        // admin has to review and verify first. Appointments created directly by
        // an admin have no proof, so they stay approvable as before.
        if (status === 'scheduled' && appointment.has_payment_proof && appointment.payment_status !== 'verified') {
            return res.status(409).json({
                error: "Review and verify the patient's half-payment proof before approving this appointment.",
                payment_status: appointment.payment_status || "submitted"
            });
        }

        // Terminal statuses are moved to the archive/history logs instead of
        // staying in the active list, and so their time slot becomes available
        // again for rebooking. Only non-terminal statuses (pending, scheduled,
        // in consultation) remain in the appointments table.
        let updatedAppointment;
        if (ARCHIVED_STATUS_VALUES.includes(status)) {
            const archivedResult = await archiveAppointment(id, status);
            if (!archivedResult.success) {
                return res.status(archivedResult.statusCode).json({ error: archivedResult.message });
            }
            updatedAppointment = archivedResult.data;
        } else {
            updatedAppointment = await updateAppointmentStatus(id, status);
        }

        // The transition can flip the doctor between Available and In
        // Consultation, so push the new presence immediately. The diff inside
        // the broadcast makes it a cheap no-op when nothing changed.
        try {
            await broadcastDoctorStatusChanges();
        } catch (broadcastErr) {
            console.error("Failed to broadcast doctor status:", broadcastErr);
        }

        // Send notifications based on status
        try {
            // start_time is a timezone-less wall clock value, so format it as such
            // instead of relying on the server's timezone.
            const startTime = formatWallClockDateTime(appointment.start_time);

            if (status === 'scheduled') {
                await sendNotification(appointment.patient_id, "Appointment Approved", `Your appointment request for ${startTime} has been approved.`);
                await sendNotification(appointment.doctor_id, "Appointment Approved", `An appointment with patient ID: ${appointment.patient_id} for ${startTime} has been approved and scheduled.`);
            } else if (status === 'declined' || status === 'cancelled') {
                await sendNotification(appointment.patient_id, "Appointment Declined", `Your appointment request for ${startTime} has been declined by the administrator.`);
                await sendNotification(appointment.doctor_id, "Appointment Declined", `The appointment request for patient ID: ${appointment.patient_id} at ${startTime} has been declined.`);
            } else if (status === 'no_show') {
                await sendNotification(appointment.patient_id, "Appointment No-Show", `Your appointment for ${startTime} was marked as a no-show.`);
                await sendNotification(appointment.doctor_id, "Appointment No-Show", `The appointment for patient ID: ${appointment.patient_id} at ${startTime} was marked as a no-show.`);
            } else if (status === 'in_consultation') {
                await sendNotification(appointment.patient_id, "Consultation Started", `Your consultation for ${startTime} has started.`);
            } else if (status === 'completed') {
                await sendNotification(appointment.patient_id, "Appointment Completed", `Your appointment for ${startTime} has been completed.`);
            }
        } catch (notifErr) {
            console.error("Failed to send status update notifications:", notifErr);
        }

        return res.json({ message: "Appointment status updated.", appointment: updatedAppointment });
    } catch (error) {
        console.error("Error updating appointment status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// The consultation_notes table ships as a separate one-time SQL migration, so
// report a clear setup message instead of a bare 500 when it is missing.
function isMissingNotesTable(error) {
    return error?.code === "42P01";
}

const NOTES_NOT_SETUP_ERROR =
    "Consultation notes are not set up yet. Run modules/appointment_management/consultation_notes.sql against the database.";

// POST /appointments/:id/notes
// The doctor (or an admin) records a note about the patient while consulting.
export async function handleCreateConsultationNote(req, res) {
    try {
        const { id } = req.params;
        const note = (req.body.note || "").trim();

        if (!note) {
            return res.status(400).json({ error: "Note text is required." });
        }

        if (note.length > 2000) {
            return res.status(400).json({ error: "Note cannot be longer than 2000 characters." });
        }

        const appointment = await getAppointmentById(id);
        if (!appointment) {
            return res.status(404).json({ error: "Appointment not found." });
        }

        if (req.user.role !== "admin" && appointment.doctor_id !== req.user.id) {
            return res.status(403).json({ error: "Forbidden: You can only add notes to your own appointments." });
        }

        const createdNote = await createConsultationNote({
            patientId: appointment.patient_id,
            appointmentId: appointment.id,
            doctorId: req.user.id,
            note
        });

        return res.status(201).json({ message: "Note saved.", note: createdNote });
    } catch (error) {
        if (isMissingNotesTable(error)) {
            return res.status(503).json({ error: NOTES_NOT_SETUP_ERROR });
        }
        console.error("Error creating consultation note:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// GET /appointments/:id/notes
export async function handleGetConsultationNotes(req, res) {
    try {
        const { id } = req.params;
        const notes = await getConsultationNotesByAppointment(id);
        return res.json({ notes });
    } catch (error) {
        if (isMissingNotesTable(error)) {
            return res.status(503).json({ error: NOTES_NOT_SETUP_ERROR });
        }
        console.error("Error fetching consultation notes:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// GET /appointments/patient/:patientId/notes
// Full consultation-note history for the patient profile view.
export async function handleGetPatientConsultationNotes(req, res) {
    try {
        const { patientId } = req.params;
        const notes = await getConsultationNotesByPatient(patientId);
        return res.json({ notes });
    } catch (error) {
        if (isMissingNotesTable(error)) {
            return res.status(503).json({ error: NOTES_NOT_SETUP_ERROR });
        }
        console.error("Error fetching patient consultation notes:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
