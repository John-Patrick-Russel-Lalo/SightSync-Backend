import { Router } from "express";
import { handleGetAvailableSlots, handleCreateAppointment, handleGetAllAppointments, handleGetAppointmentByDoctorId, handleCreateAppointmentByPatient, handleUpdateAppointmentStatus, handleGetAppointmentByPatientId, handleGetArchivedAppointments, handleGetArchivedAppointmentsForCurrentUser } from "./appointment.controller.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js"
import { requireAuth } from "../../shared/middleware/authMiddleware.js"
const router = Router();

router.get("/my", requireAuth, requireRole("patient", "admin", "doctor"), handleGetAppointmentByPatientId);
router.get("/archive/my", requireAuth, requireRole("patient", "admin", "doctor"), handleGetArchivedAppointmentsForCurrentUser);
router.get("/archive", requireAuth, requireRole("admin", "doctor"), handleGetArchivedAppointments);
router.get("/:doctorId/:date", requireAuth, handleGetAvailableSlots);
router.get("/", requireAuth, requireRole("admin", "doctor"), handleGetAllAppointments);
router.get("/:doctorId", requireAuth, requireRole("admin", "doctor"), handleGetAppointmentByDoctorId);
router.post("/", requireAuth, requireRole("admin"), handleCreateAppointment);
router.post("/patient", requireAuth, requireRole("patient"), handleCreateAppointmentByPatient);
router.patch("/:id/status", requireAuth, requireRole("admin"), handleUpdateAppointmentStatus);

export default router;