import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import {
    getMyNotifications,
    markRead,
    markAllRead
} from "./notification.controller.js";

const router = express.Router();

router.get("/", requireAuth, getMyNotifications);
router.patch("/mark-all-read", requireAuth, markAllRead);
router.patch("/:id/read", requireAuth, markRead);

export default router;
