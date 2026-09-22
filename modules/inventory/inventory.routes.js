// inventory.routes.js
import { Router } from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import {
  handleGetAllFrames,
  handleGetFrameById,
  handleCreateFrame,
  handleUpdateFrame,
  handleDeleteFrame,
  handleGetAllLenses,
  handleGetLensById,
  handleCreateLens,
  handleUpdateLens,
  handleDeleteLens,
  handleGetAllInventory,
  handleGetInventoryById,
  handleGetLowStock,
  handleCreateInventoryItem,
  handleUpdateInventoryItem,
  handleAdjustStock,
  handleDeleteInventoryItem,
} from "./inventory.controller.js";

const router = Router();

// Order matters: static paths (/low-stock, /frames, /lenses) must be
// registered before the dynamic /:id routes.

// Frames
router.get("/frames", requireAuth, requireRole("admin"), handleGetAllFrames);
router.get("/frames/:id", requireAuth, requireRole("admin"), handleGetFrameById);
router.post("/frames", requireAuth, requireRole("admin"), handleCreateFrame);
router.put("/frames/:id", requireAuth, requireRole("admin"), handleUpdateFrame);
router.delete("/frames/:id", requireAuth, requireRole("admin"), handleDeleteFrame);

// Lenses
router.get("/lenses", requireAuth, requireRole("admin"), handleGetAllLenses);
router.get("/lenses/:id", requireAuth, requireRole("admin"), handleGetLensById);
router.post("/lenses", requireAuth, requireRole("admin"), handleCreateLens);
router.put("/lenses/:id", requireAuth, requireRole("admin"), handleUpdateLens);
router.delete("/lenses/:id", requireAuth, requireRole("admin"), handleDeleteLens);

// Inventory
router.get("/low-stock", requireAuth, requireRole("admin"), handleGetLowStock);
router.get("/", requireAuth, requireRole("admin"), handleGetAllInventory);
router.post("/", requireAuth, requireRole("admin"), handleCreateInventoryItem);

router.patch("/:id/stock", requireAuth, requireRole("admin"), handleAdjustStock);

router.get("/:id", requireAuth, requireRole("admin"), handleGetInventoryById);
router.put("/:id", requireAuth, requireRole("admin"), handleUpdateInventoryItem);
router.delete("/:id", requireAuth, requireRole("admin"), handleDeleteInventoryItem);

export default router;