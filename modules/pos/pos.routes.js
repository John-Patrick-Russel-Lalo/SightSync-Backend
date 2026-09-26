// pos.routes.js
import { Router } from "express";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import {
  handleCreateSale,
  handleGetAllSales,
  handleGetSaleById,
  handleGetSalesBySeller,
  handleGetSalesSummary,
  handleVoidSale,
} from "./pos.controller.js";

const router = Router();

// Order matters: static paths (/sales/summary, /sales/seller/:userId)
// must be registered before the dynamic /sales/:id route.

router.post("/sales", requireAuth, requireRole("admin"), handleCreateSale);

router.get("/sales/summary", requireAuth, requireRole("admin"), handleGetSalesSummary);
router.get("/sales/seller/:userId", requireAuth, requireRole("admin"), handleGetSalesBySeller);
router.get("/sales/:id", requireAuth, requireRole("admin"), handleGetSaleById);
router.get("/sales", requireAuth, requireRole("admin"), handleGetAllSales);

router.patch("/sales/:id/void", requireAuth, requireRole("admin"), handleVoidSale);

export default router;