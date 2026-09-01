import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import { updateMyPatientProfileValidator } from "./patient.service.js";
import {
  getMyProfile,
  updateProfile,
  updateMyPatientProfile
} from "./patient.controller.js";

const router = express.Router();

router.get("/", requireAuth, getMyProfile);

router.patch("/", requireAuth, requireRole("admin"), updateProfile);

router.put(
  "/profile",
  requireAuth,
  requireRole("patient"),
  updateMyPatientProfileValidator,
  updateMyPatientProfile,
);

export default router;
