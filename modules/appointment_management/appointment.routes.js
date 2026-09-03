import { Router } from "express";
import { handleGetAvailableSlots, handleCreateAppointment, handleGetAllAppointments } from "./appointment.controller.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js"
import { requireAuth } from "../../shared/middleware/authMiddleware.js"
const router = Router();

router.get("/:doctorId/:date", requireAuth, handleGetAvailableSlots);
router.get("/", requireAuth, requireRole("admin", "doctor"), handleGetAllAppointments);
router.post("/", requireAuth, handleCreateAppointment);

export default router;