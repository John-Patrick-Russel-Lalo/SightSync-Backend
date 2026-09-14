import { Router } from "express";
import { handleGetAvailableSlots, handleCreateAppointment, handleGetAllAppointments, handleGetAppointmentByDoctorId, handleCreateAppointmentByPatient } from "./appointment.controller.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js"
import { requireAuth } from "../../shared/middleware/authMiddleware.js"
const router = Router();

router.get("/:doctorId/:date", requireAuth, handleGetAvailableSlots);
router.get("/", requireAuth, requireRole("admin", "doctor"), handleGetAllAppointments);
router.get("/:doctorId", requireAuth, requireRole("admin", "doctor"), handleGetAppointmentByDoctorId);
router.post("/", requireAuth, requireRole("admin"), handleCreateAppointment);
router.post("/patient", requireAuth, requireRole("patient"), handleCreateAppointmentByPatient);

export default router;