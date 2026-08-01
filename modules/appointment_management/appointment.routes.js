import express from "express";
import { getAvailableSlotsController } from "./appointment.controller.js";

const router = express.Router();

router.get("/:doctorId/:selectedDate", getAvailableSlotsController);

export default router;