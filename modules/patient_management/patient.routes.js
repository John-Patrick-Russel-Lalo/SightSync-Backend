import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import {
  getMyProfile,
  updateMyProfile
} from "./patient.controller.js";

const router = express.Router();

router.get("/", requireAuth, getMyProfile);
router.patch("/", requireAuth, updateMyProfile);

export default router;
