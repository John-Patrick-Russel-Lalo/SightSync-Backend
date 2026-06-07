import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import { deleteUser, updateUser } from "./users.controller.js";

const router = express.Router();

router.patch("/:id", requireAuth, updateUser, (req, res, next) => {
    requireRole("admin", req.user.id)(req, res, next);
});

router.delete("/:id", requireAuth, deleteUser, (req, res, next) => {
    requireRole("admin", req.user.id)(req, res, next);
});

export default router;
