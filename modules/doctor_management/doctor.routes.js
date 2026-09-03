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

router.get("/", requireAuth, requireRole("admin"), handleGetAllDoctorProfiles);
router.get("/:userId", requireAuth, requireRole("admin"), handleGetDoctorProfileByUserId);
router.post("/", requireAuth, requireRole("admin"), handleCreateDoctorProfile);
router.put("/:userId", requireAuth, requireRole("admin"), handleUpdateDoctorProfile);
router.delete("/:userId", requireAuth, requireRole("admin"), handleDeleteDoctorProfile);

export default router;