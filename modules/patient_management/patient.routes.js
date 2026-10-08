import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import { updateMyPatientProfileValidator } from "./patient.service.js";
import {
  getMyProfile,
  updateProfile,
  updateMyPatientProfile,
  getPatientProfileByPatientId,
  updatePatientStatusController,
  handleGetPatientReport,
  handleGetPatientReportSummary,
  handlePostPatientReportSummary
} from "./patient.controller.js";

const router = express.Router();

// Defense in depth on top of the weekly limit: at most 5 generate attempts per
// 15 minutes per address (same budget as the shared /ai route).
const reportSummaryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many summary requests. Please wait a few minutes and try again." },
});

router.get("/", requireAuth, getMyProfile);

// Admins and doctors may correct a patient's profile when the recorded
// information is inaccurate. Both pass the target patient's user id as body.id.
router.patch("/", requireAuth, requireRole("admin", "doctor"), updateProfile);

router.put(
  "/profile",
  requireAuth,
  requireRole("patient"),
  updateMyPatientProfileValidator,
  updateMyPatientProfile,
);

// Registered above "/:patientId" so "report" is not swallowed as an id.
router.get(
  "/:patientId/report",
  requireAuth,
  requireRole("admin", "doctor"),
  handleGetPatientReport
);

// Read-only: serves the stored summary when it is still within its week.
router.get(
  "/:patientId/report/summary",
  requireAuth,
  requireRole("admin", "doctor"),
  handleGetPatientReportSummary
);

// Generates at most one new summary per patient per week; returns the stored
// copy (cached: true) when the current one is still fresh.
router.post(
  "/:patientId/report/summary",
  requireAuth,
  requireRole("admin", "doctor"),
  reportSummaryLimiter,
  handlePostPatientReportSummary
);

router.get(
  "/:patientId",
  requireAuth,
  requireRole("admin", "doctor"),
  getPatientProfileByPatientId
);

router.patch("/status", requireAuth, requireRole("admin"), updatePatientStatusController);

export default router;
