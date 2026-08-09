import { Router } from "express";
import { handleGetAvailableSlots, handleCreateAppointment } from "./appointment.controller.js";

const router = Router();

router.get("/:doctorId/:date", handleGetAvailableSlots);

router.post("/", handleCreateAppointment);

export default router;