import { Router } from "express";
import { handleGetAvailableSlots, handleCreateAppointment, handleGetAllAppointments, handleGetAppointmentByDoctorId, handleCreateAppointmentByPatient, handleUpdateAppointmentStatus, handleGetAppointmentByPatientId, handleGetArchivedAppointments, handleGetArchivedAppointmentsForCurrentUser, handleGetPaymentProof, handleUpdatePaymentVerification, handleCreateConsultationNote, handleGetConsultationNotes, handleGetPatientConsultationNotes } from "./appointment.controller.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js"
import { requireAuth } from "../../shared/middleware/authMiddleware.js"
import { withPaymentProofUpload } from "../../shared/middleware/uploadMiddleware.js"
const router = Router();

router.get("/my", requireAuth, requireRole("patient", "admin", "doctor"), handleGetAppointmentByPatientId);
router.get("/archive/my", requireAuth, requireRole("patient", "admin", "doctor"), handleGetArchivedAppointmentsForCurrentUser);
router.get("/archive", requireAuth, requireRole("admin", "doctor"), handleGetArchivedAppointments);
// Registered above the "/:doctorId/:date" slot route so "payment-proof" and
// "notes" are not swallowed as a date.
router.get("/:id/payment-proof", requireAuth, requireRole("admin", "doctor", "patient"), handleGetPaymentProof);
router.get("/:id/notes", requireAuth, requireRole("admin", "doctor"), handleGetConsultationNotes);
router.get("/patient/:patientId/notes", requireAuth, requireRole("admin", "doctor"), handleGetPatientConsultationNotes);
router.get("/:doctorId/:date", requireAuth, handleGetAvailableSlots);
router.get("/", requireAuth, requireRole("admin", "doctor"), handleGetAllAppointments);
router.get("/:doctorId", requireAuth, requireRole("admin", "doctor"), handleGetAppointmentByDoctorId);
router.post("/", requireAuth, requireRole("admin"), handleCreateAppointment);
router.post("/patient", requireAuth, requireRole("patient"), withPaymentProofUpload, handleCreateAppointmentByPatient);
router.post("/:id/notes", requireAuth, requireRole("admin", "doctor"), handleCreateConsultationNote);
// Admins manage the full lifecycle; doctors may mark their own appointments
// as in-consultation or completed (enforced inside the handler).
router.patch("/:id/status", requireAuth, requireRole("admin", "doctor"), handleUpdateAppointmentStatus);
router.patch("/:id/payment-verification", requireAuth, requireRole("admin"), handleUpdatePaymentVerification);

export default router;