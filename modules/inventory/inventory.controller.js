// inventory.controller.js
import {
  getAllFrames,
  getFrameById,
  createFrame,
  updateFrame,
  deleteFrame,
  getAllLenses,
  getLensById,
  createLens,
  updateLens,
  deleteLens,
  getAllInventory,
  getInventoryById,
  getLowStockInventory,
  createInventoryItem,
  updateInventoryItem,
  updateInventoryQuantity,
  deleteInventoryItem,
} from "./inventory.service.js";

const FRAME_CATEGORIES = ["frame", "lens", "accessory"];
const FRAME_GENDERS = ["unisex", "men", "women", "kids"];

function isInvalidPositiveNumber(value, allowZero = true) {
  if (value === undefined || value === null || value === "") return false;
  const num = Number(value);
  if (!Number.isFinite(num)) return true;
  return allowZero ? num < 0 : num <= 0;
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

export async function handleGetAllFrames(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const frames = await getAllFrames(limit, offset);

    res.json({ data: frames, count: frames.length, limit, offset });
  } catch (error) {
    console.error("Error fetching all frames:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetFrameById(req, res) {
  try {
    const { id } = req.params;

    const frame = await getFrameById(id);

    if (!frame) {
      return res.status(404).json({ error: "Frame not found." });
    }

    res.json({ data: frame });
  } catch (error) {
    console.error("Error fetching frame:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleCreateFrame(req, res) {
  try {
    const { brand, modelNumber } = req.body;

    if (!brand || !modelNumber) {
      return res
        .status(400)
        .json({ error: "brand and modelNumber are required." });
    }

    const { gender } = req.body;
    if (gender && !FRAME_GENDERS.includes(gender)) {
      return res.status(400).json({
        error: `gender must be one of: ${FRAME_GENDERS.join(", ")}.`,
      });
    }

    const frame = await createFrame(req.body);

    res.status(201).json({
      message: "Frame created successfully.",
      data: frame,
    });
  } catch (error) {
    console.error("Error creating frame:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleUpdateFrame(req, res) {
  try {
    const { id } = req.params;

    const existing = await getFrameById(id);
    if (!existing) {
      return res.status(404).json({ error: "Frame not found." });
    }

    const { gender } = req.body;
    if (gender && !FRAME_GENDERS.includes(gender)) {
      return res.status(400).json({
        error: `gender must be one of: ${FRAME_GENDERS.join(", ")}.`,
      });
    }

    const frame = await updateFrame(id, req.body);

    res.json({ message: "Frame updated successfully.", data: frame });
  } catch (error) {
    console.error("Error updating frame:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleDeleteFrame(req, res) {
  try {
    const { id } = req.params;

    const deleted = await deleteFrame(id);

    if (!deleted) {
      return res.status(404).json({ error: "Frame not found." });
    }

    res.json({ message: "Frame deleted successfully.", data: deleted });
  } catch (error) {
    console.error("Error deleting frame:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ---------------------------------------------------------------------------
// Lenses
// ---------------------------------------------------------------------------

export async function handleGetAllLenses(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const lenses = await getAllLenses(limit, offset);

    res.json({ data: lenses, count: lenses.length, limit, offset });
  } catch (error) {
    console.error("Error fetching all lenses:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetLensById(req, res) {
  try {
    const { id } = req.params;

    const lens = await getLensById(id);

    if (!lens) {
      return res.status(404).json({ error: "Lens not found." });
    }

    res.json({ data: lens });
  } catch (error) {
    console.error("Error fetching lens:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleCreateLens(req, res) {
  try {
    const { brand, lensType, material } = req.body;

    if (!brand || !lensType || !material) {
      return res.status(400).json({
        error: "brand, lensType, and material are required.",
      });
    }

    const lens = await createLens(req.body);

    res.status(201).json({
      message: "Lens created successfully.",
      data: lens,
    });
  } catch (error) {
    console.error("Error creating lens:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleUpdateLens(req, res) {
  try {
    const { id } = req.params;

    const existing = await getLensById(id);
    if (!existing) {
      return res.status(404).json({ error: "Lens not found." });
    }

    const lens = await updateLens(id, req.body);

    res.json({ message: "Lens updated successfully.", data: lens });
  } catch (error) {
    console.error("Error updating lens:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleDeleteLens(req, res) {
  try {
    const { id } = req.params;

    const deleted = await deleteLens(id);

    if (!deleted) {
      return res.status(404).json({ error: "Lens not found." });
    }

    res.json({ message: "Lens deleted successfully.", data: deleted });
  } catch (error) {
    console.error("Error deleting lens:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function handleGetAllInventory(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const items = await getAllInventory(limit, offset);

    res.json({ data: items, count: items.length, limit, offset });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetLowStock(req, res) {
  try {
    const items = await getLowStockInventory();

    res.json({ data: items, count: items.length });
  } catch (error) {
    console.error("Error fetching low stock inventory:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleGetInventoryById(req, res) {
  try {
    const { id } = req.params;

    const item = await getInventoryById(id);

    if (!item) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    res.json({ data: item });
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleCreateInventoryItem(req, res) {
  try {
    const { sku, category, frameId, lensId } = req.body;

    if (!sku || !category) {
      return res.status(400).json({
        error: "sku and category are required.",
      });
    }

    if (!FRAME_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${FRAME_CATEGORIES.join(", ")}.`,
      });
    }

    // Category determines which reference must be provided.
    if (category === "frame" && !frameId) {
      return res.status(400).json({
        error: "frameId is required for category 'frame'.",
      });
    }

    if (category === "lens" && !lensId) {
      return res.status(400).json({
        error: "lensId is required for category 'lens'.",
      });
    }

    if (category !== "frame" && frameId) {
      return res.status(400).json({
        error: "frameId can only be set for category 'frame'.",
      });
    }

    if (category !== "lens" && lensId) {
      return res.status(400).json({
        error: "lensId can only be set for category 'lens'.",
      });
    }

    const { quantity } = req.body;
    if (isInvalidPositiveNumber(quantity)) {
      return res.status(400).json({ error: "quantity must be >= 0." });
    }

    const item = await createInventoryItem(req.body);

    res.status(201).json({
      message: "Inventory item created successfully.",
      data: item,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "SKU already exists." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ error: "Referenced item does not exist." });
    }
    console.error("Error creating inventory item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleUpdateInventoryItem(req, res) {
  try {
    const { id } = req.params;

    const existing = await getInventoryById(id);
    if (!existing) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    const { category, frameId, lensId, quantity } = req.body;

    if (category && !FRAME_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${FRAME_CATEGORIES.join(", ")}.`,
      });
    }

    const resolvedCategory = category || existing.category;

    if (resolvedCategory === "frame" && frameId === undefined && !existing.frame) {
      return res.status(400).json({
        error: "frameId is required for category 'frame'.",
      });
    }

    if (resolvedCategory === "lens" && lensId === undefined && !existing.lens) {
      return res.status(400).json({
        error: "lensId is required for category 'lens'.",
      });
    }

    if (resolvedCategory !== "frame" && frameId) {
      return res.status(400).json({
        error: "frameId can only be set for category 'frame'.",
      });
    }

    if (resolvedCategory !== "lens" && lensId) {
      return res.status(400).json({
        error: "lensId can only be set for category 'lens'.",
      });
    }

    if (isInvalidPositiveNumber(quantity)) {
      return res.status(400).json({ error: "quantity must be >= 0." });
    }

    const item = await updateInventoryItem(id, req.body);

    res.json({ message: "Inventory item updated successfully.", data: item });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "SKU already exists." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ error: "Referenced item does not exist." });
    }
    console.error("Error updating inventory item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleAdjustStock(req, res) {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || isInvalidPositiveNumber(quantity)) {
      return res.status(400).json({ error: "quantity is required and must be >= 0." });
    }

    const item = await updateInventoryQuantity(id, quantity);

    if (!item) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    res.json({
      message: "Stock quantity updated successfully.",
      data: item,
    });
  } catch (error) {
    if (error.code === "23514") {
      return res.status(400).json({ error: "quantity cannot be negative." });
    }
    console.error("Error adjusting stock:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function handleDeleteInventoryItem(req, res) {
  try {
    const { id } = req.params;

    const deleted = await deleteInventoryItem(id);

    if (!deleted) {
      return res.status(404).json({ error: "Inventory item not found." });
    }

    res.json({ message: "Inventory item deleted successfully.", data: deleted });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}