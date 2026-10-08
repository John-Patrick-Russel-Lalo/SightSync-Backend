import express from "express";
import { aiController, aiAnalyticsSummaryController } from "./ai.controller.js";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";

const router = express.Router();

const mins = 15

const rateLimiter = rateLimit({
    windowMs: mins * 60 * 1000, 
    max: 5, 
    message: `Too many requests from this IP, please try again after ${mins} minutes`
});

router.post("/generate-summary", rateLimiter, aiController);

// Summarizes the numbers shown on the admin Analytics page. Locked to admins
// so the AI key cannot be spent by other roles.
router.post(
    "/analytics-summary",
    requireAuth,
    requireRole("admin"),
    rateLimiter,
    aiAnalyticsSummaryController
);

export default router;