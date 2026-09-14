import { Router } from "express";
import {
    handleGetAllDoctorProfiles,
    handleGetDoctorProfileByUserId,
    handleCreateDoctorProfile,
    handleUpdateDoctorProfile,
    handleDeleteDoctorProfile,
} from "./doctor.controller.js";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin", "doctor"), handleGetAllDoctorProfiles);
router.get("/:userId", requireAuth, requireRole("admin", "doctor"), handleGetDoctorProfileByUserId);
router.post("/", requireAuth, requireRole("admin", "doctor"), handleCreateDoctorProfile);
router.put("/:userId", requireAuth, requireRole("admin", "doctor"), handleUpdateDoctorProfile);
router.delete("/:userId", requireAuth, requireRole("admin", "doctor"), handleDeleteDoctorProfile);

export default router;