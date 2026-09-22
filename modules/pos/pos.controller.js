// pos.controller.js
import {
  createSale,
  getAllSales,
  getSaleById,
  getSalesBySeller,
  getSalesSummary,
  voidSale,
} from "./pos.service.js";

export async function handleCreateSale(req, res) {
  try {
    const {
      items,
      customerName,
      paymentMethod,
      amountTendered,
      discountAmount,
      taxRate,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "items must be a non-empty array of { inventoryId, quantity }.",
      });
    }

    for (const line of items) {
      if (!line.inventoryId || !Number.isInteger(line.quantity) || line.quantity <= 0) {
        return res.status(400).json({
          error: "Each item requires a valid inventoryId and a positive integer quantity.",
        });
      }
    }

    const result = await createSale({
      items,
      customerName,
      paymentMethod,
      amountTendered,
      discountAmount,
      taxRate,
      soldBy: req.user.id,
    });

    if (!result.success) {
      return res.status(result.statusCode).json({ error: result.message });
    }

    return res.status(201).json({
      message: "Sale completed successfully.",
      sale: result.data,
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({ error: "Referenced item does not exist." });
    }
    console.error("Error creating sale:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetAllSales(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const sales = await getAllSales(limit, offset);

    res.json({ data: sales, count: sales.length, limit, offset });
  } catch (error) {
    console.error("Error fetching all sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetSaleById(req, res) {
  try {
    const { id } = req.params;

    const sale = await getSaleById(id);

    if (!sale) {
      return res.status(404).json({ error: "Sale not found." });
    }

    res.json({ data: sale });
  } catch (error) {
    console.error("Error fetching sale:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetSalesBySeller(req, res) {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const sales = await getSalesBySeller(userId, limit, offset);

    res.json({ data: sales, count: sales.length, limit, offset });
  } catch (error) {
    console.error("Error fetching sales by seller:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetSalesSummary(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "startDate and endDate query parameters (YYYY-MM-DD) are required.",
      });
    }

    const summary = await getSalesSummary(startDate, endDate);

    res.json({ data: summary });
  } catch (error) {
    console.error("Error fetching sales summary:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleVoidSale(req, res) {
  try {
    const { id } = req.params;

    const result = await voidSale(id);

    if (!result.success) {
      return res.status(result.statusCode).json({ error: result.message });
    }

    res.json({
      message: "Sale voided and stock restored.",
      data: result.data,
    });
  } catch (error) {
    console.error("Error voiding sale:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}