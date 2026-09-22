// inventory.service.js
import pool from "../../shared/config/db.js";

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

export async function getAllFrames(limit = 50, offset = 0) {
  const result = await pool.query(
    `
    SELECT *
    FROM frames
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

export async function getFrameById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM frames
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function createFrame(frameData) {
  const {
    brand,
    modelNumber,
    color,
    frameType,
    material,
    gender = "unisex",
    lensWidth,
    bridgeWidth,
    templeLength,
  } = frameData;

  const result = await pool.query(
    `
    INSERT INTO frames (
      brand,
      model_number,
      color,
      frame_type,
      material,
      gender,
      lens_width,
      bridge_width,
      temple_length
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      brand,
      modelNumber,
      color || null,
      frameType || null,
      material || null,
      gender,
      lensWidth || null,
      bridgeWidth || null,
      templeLength || null,
    ]
  );

  return result.rows[0];
}

export async function updateFrame(id, frameData) {
  const {
    brand,
    modelNumber,
    color,
    frameType,
    material,
    gender,
    lensWidth,
    bridgeWidth,
    templeLength,
  } = frameData;

  const result = await pool.query(
    `
    UPDATE frames
    SET
      brand = COALESCE($1, brand),
      model_number = COALESCE($2, model_number),
      color = COALESCE($3, color),
      frame_type = COALESCE($4, frame_type),
      material = COALESCE($5, material),
      gender = COALESCE($6, gender),
      lens_width = COALESCE($7, lens_width),
      bridge_width = COALESCE($8, bridge_width),
      temple_length = COALESCE($9, temple_length),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING *
    `,
    [
      brand || null,
      modelNumber || null,
      color || null,
      frameType || null,
      material || null,
      gender || null,
      lensWidth || null,
      bridgeWidth || null,
      templeLength || null,
      id,
    ]
  );

  return result.rows[0] || null;
}

export async function deleteFrame(id) {
  const result = await pool.query(
    `
    DELETE FROM frames
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Lenses
// ---------------------------------------------------------------------------

export async function getAllLenses(limit = 50, offset = 0) {
  const result = await pool.query(
    `
    SELECT *
    FROM lenses
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

export async function getLensById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM lenses
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function createLens(lensData) {
  const {
    brand,
    lensType,
    material,
    indexValue,
    coating,
    minSphere,
    maxSphere,
    minCylinder,
    maxCylinder,
  } = lensData;

  const result = await pool.query(
    `
    INSERT INTO lenses (
      brand,
      lens_type,
      material,
      index_value,
      coating,
      min_sphere,
      max_sphere,
      min_cylinder,
      max_cylinder
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      brand,
      lensType,
      material,
      indexValue || null,
      coating || null,
      minSphere || null,
      maxSphere || null,
      minCylinder || null,
      maxCylinder || null,
    ]
  );

  return result.rows[0];
}

export async function updateLens(id, lensData) {
  const {
    brand,
    lensType,
    material,
    indexValue,
    coating,
    minSphere,
    maxSphere,
    minCylinder,
    maxCylinder,
  } = lensData;

  const result = await pool.query(
    `
    UPDATE lenses
    SET
      brand = COALESCE($1, brand),
      lens_type = COALESCE($2, lens_type),
      material = COALESCE($3, material),
      index_value = COALESCE($4, index_value),
      coating = COALESCE($5, coating),
      min_sphere = COALESCE($6, min_sphere),
      max_sphere = COALESCE($7, max_sphere),
      min_cylinder = COALESCE($8, min_cylinder),
      max_cylinder = COALESCE($9, max_cylinder),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING *
    `,
    [
      brand || null,
      lensType || null,
      material || null,
      indexValue || null,
      coating || null,
      minSphere || null,
      maxSphere || null,
      minCylinder || null,
      maxCylinder || null,
      id,
    ]
  );

  return result.rows[0] || null;
}

export async function deleteLens(id) {
  const result = await pool.query(
    `
    DELETE FROM lenses
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function getAllInventory(limit = 50, offset = 0) {
  const result = await pool.query(
    `
    SELECT
      i.id,
      i.sku,
      i.category,
      i.quantity,
      i.reorder_level,
      i.unit_cost,
      i.selling_price,
      i.is_active,
      i.created_at,
      i.updated_at,
      CASE WHEN i.frame_id IS NOT NULL THEN jsonb_build_object(
        'id', f.id,
        'brand', f.brand,
        'model_number', f.model_number,
        'color', f.color,
        'frame_type', f.frame_type,
        'material', f.material,
        'gender', f.gender
      ) ELSE NULL END AS frame,
      CASE WHEN i.lens_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id,
        'brand', l.brand,
        'lens_type', l.lens_type,
        'material', l.material,
        'index_value', l.index_value,
        'coating', l.coating
      ) ELSE NULL END AS lens
    FROM inventory i
    LEFT JOIN frames f ON i.frame_id = f.id
    LEFT JOIN lenses l ON i.lens_id = l.id
    WHERE i.is_active = TRUE
    ORDER BY i.created_at DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

export async function getInventoryById(id) {
  const result = await pool.query(
    `
    SELECT
      i.id,
      i.sku,
      i.category,
      i.quantity,
      i.reorder_level,
      i.unit_cost,
      i.selling_price,
      i.is_active,
      i.created_at,
      i.updated_at,
      CASE WHEN i.frame_id IS NOT NULL THEN jsonb_build_object(
        'id', f.id,
        'brand', f.brand,
        'model_number', f.model_number,
        'color', f.color,
        'frame_type', f.frame_type,
        'material', f.material,
        'gender', f.gender
      ) ELSE NULL END AS frame,
      CASE WHEN i.lens_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id,
        'brand', l.brand,
        'lens_type', l.lens_type,
        'material', l.material,
        'index_value', l.index_value,
        'coating', l.coating
      ) ELSE NULL END AS lens
    FROM inventory i
    LEFT JOIN frames f ON i.frame_id = f.id
    LEFT JOIN lenses l ON i.lens_id = l.id
    WHERE i.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

export async function getLowStockInventory() {
  const result = await pool.query(
    `
    SELECT
      i.id,
      i.sku,
      i.category,
      i.quantity,
      i.reorder_level,
      i.unit_cost,
      i.selling_price,
      i.is_active,
      i.created_at,
      i.updated_at,
      CASE WHEN i.frame_id IS NOT NULL THEN jsonb_build_object(
        'id', f.id,
        'brand', f.brand,
        'model_number', f.model_number,
        'color', f.color,
        'material', f.material
      ) ELSE NULL END AS frame,
      CASE WHEN i.lens_id IS NOT NULL THEN jsonb_build_object(
        'id', l.id,
        'brand', l.brand,
        'lens_type', l.lens_type,
        'material', l.material,
        'coating', l.coating
      ) ELSE NULL END AS lens
    FROM inventory i
    LEFT JOIN frames f ON i.frame_id = f.id
    LEFT JOIN lenses l ON i.lens_id = l.id
    WHERE i.quantity <= i.reorder_level
      AND i.is_active = TRUE
    ORDER BY (i.quantity - i.reorder_level) ASC
    `
  );

  return result.rows;
}

export async function createInventoryItem(inventoryData) {
  const {
    sku,
    category,
    frameId,
    lensId,
    quantity = 0,
    reorderLevel = 5,
    unitCost = 0,
    sellingPrice = 0,
  } = inventoryData;

  const result = await pool.query(
    `
    INSERT INTO inventory (
      sku,
      category,
      frame_id,
      lens_id,
      quantity,
      reorder_level,
      unit_cost,
      selling_price
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [
      sku,
      category,
      frameId || null,
      lensId || null,
      quantity,
      reorderLevel,
      unitCost,
      sellingPrice,
    ]
  );

  return result.rows[0];
}

export async function updateInventoryItem(id, inventoryData) {
  const {
    sku,
    category,
    frameId,
    lensId,
    quantity,
    reorderLevel,
    unitCost,
    sellingPrice,
  } = inventoryData;

  // Special handling for nullable FK columns: they must be settable to NULL
  // when switching categories, so use explicit placeholders instead of COALESCE.
  const result = await pool.query(
    `
    UPDATE inventory
    SET
      sku = COALESCE($1, sku),
      category = COALESCE($2, category),
      frame_id = $3,
      lens_id = $4,
      quantity = COALESCE($5, quantity),
      reorder_level = COALESCE($6, reorder_level),
      unit_cost = COALESCE($7, unit_cost),
      selling_price = COALESCE($8, selling_price),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
    `,
    [
      sku || null,
      category || null,
      frameId !== undefined ? frameId : null,
      lensId !== undefined ? lensId : null,
      quantity !== undefined ? quantity : null,
      reorderLevel !== undefined ? reorderLevel : null,
      unitCost !== undefined ? unitCost : null,
      sellingPrice !== undefined ? sellingPrice : null,
      id,
    ]
  );

  return result.rows[0] || null;
}

export async function updateInventoryQuantity(id, quantity) {
  const result = await pool.query(
    `
    UPDATE inventory
    SET
      quantity = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id, quantity]
  );

  return result.rows[0] || null;
}

export async function deleteInventoryItem(id) {
  // Soft delete (archive): the row must persist because sale_items references it
  // (sales history / audit trail) and voidSale needs it to restore stock.
  const result = await pool.query(
    `
    UPDATE inventory
    SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}