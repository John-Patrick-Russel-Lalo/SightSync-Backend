import express from "express";
import { aiController } from "./ai.controller.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const mins = 15

const rateLimiter = rateLimit({
    windowMs: mins * 60 * 1000, 
    max: 5, 
    message: `Too many requests from this IP, please try again after ${mins} minutes`
});

router.post("/generate-summary", rateLimiter, aiController);

export default router;