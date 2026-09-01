import express from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import { getAllUserController, getUserByIdController, deleteUser, updateUser } from "./users.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), getAllUserController);

router.get("/:id", requireAuth, requireRole("admin"), getUserByIdController);

router.patch("/:id", requireAuth, requireRole("admin"), updateUser);

router.delete("/:id", requireAuth, requireRole("admin"), deleteUser);

export default router;
