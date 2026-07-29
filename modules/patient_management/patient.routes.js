import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import {
  getMyProfile,
  updateProfile,
  updateMyPatientProfile
} from "./patient.controller.js";

const router = express.Router();

router.get("/", requireAuth, getMyProfile);
router.patch("/", requireAuth, updateProfile, (req, res, next) => {
  requireRole("admin", req.user.id)(req, res, next);
});

router.put(
    "/profile",
    requireAuth,
    updateMyPatientProfile,
    (req, res, next) => {
        requireRole("patient", req.user.id)(req, res, next);
    }
);

export default router;
