import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import { updateMyPatientProfileValidator } from "./patient.service.js";
import {
  getMyProfile,
  updateProfile,
  updateMyPatientProfile,
  getPatientProfileByPatientId,
  updatePatientStatusController
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

router.get(
  "/:patientId",
  requireAuth,
  requireRole("admin", "doctor"),
  getPatientProfileByPatientId
);

router.patch("/status", requireAuth, requireRole("admin"), updatePatientStatusController);

export default router;
