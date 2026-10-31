/**
 * Import the Balayan frames + lenses workbook into the SightSync database.
 *
 * Source : Balayan_Frames_Lenses_Products_Inventory_2026(1).xlsx
 * Sheets : "Frames Inventory" -> frames + inventory (category = 'frame')
 *          "Lenses"           -> lenses + inventory (category = 'lens')
 *          "Products"         -> intentionally skipped (frame + lens bundles)
 *
 * Frames get a deterministic model number / SKU built from a brand slug plus a
 * per-brand sequence, e.g. RAYBAN-001. Lenses use the SKU from the workbook.
 *
 * Re-running the script is safe. Existing rows are matched by inventory SKU:
 * prices/costs and catalog details are refreshed, while live stock quantities
 * for frames are preserved. Lens quantities are only refreshed with
 * --update-stock.
 *
 * Usage (from the backend folder):
 *   node scripts/importBalayanFrames.js
 *   node scripts/importBalayanFrames.js --dry-run
 *   node scripts/importBalayanFrames.js --file "C:\path\to\file.xlsx"
 *   node scripts/importBalayanFrames.js --update-stock
 *   node scripts/importBalayanFrames.js --quantity 10 --reorder-level 2
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_FILE = path.resolve(
  __dirname,
  "../../Balayan_Frames_Lenses_Products_Inventory_2026(1).xlsx",
);

const FRAME_GENDERS = ["unisex", "men", "women", "kids"];

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    updateStock: false,
    quantity: 0,
    reorderLevel: 5,
    unitCost: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--update-stock") {
      args.updateStock = true;
    } else if (arg === "--file") {
      args.file = path.resolve(argv[(i += 1)]);
    } else if (arg === "--quantity") {
      args.quantity = Number(argv[(i += 1)]);
    } else if (arg === "--reorder-level") {
      args.reorderLevel = Number(argv[(i += 1)]);
    } else if (arg === "--unit-cost") {
      args.unitCost = Number(argv[(i += 1)]);
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: node scripts/importBalayanFrames.js [--file <xlsx>] [--dry-run] [--update-stock] [--quantity <n>] [--reorder-level <n>] [--unit-cost <n>]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.quantity) || args.quantity < 0) {
    throw new Error("--quantity must be a non-negative number");
  }
  if (!Number.isFinite(args.reorderLevel) || args.reorderLevel < 0) {
    throw new Error("--reorder-level must be a non-negative number");
  }
  if (!Number.isFinite(args.unitCost) || args.unitCost < 0) {
    throw new Error("--unit-cost must be a non-negative number");
  }

  return args;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyBrand(brand) {
  const slug = brand
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "FRAME";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value, fallback = true) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "inactive"].includes(normalized)) return false;
  return fallback;
}

function parseGender(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  return FRAME_GENDERS.includes(normalized) ? normalized : null;
}

function findSheet(workbook, matcher) {
  const name = workbook.SheetNames.find((sheetName) => matcher(sheetName));
  return name ? workbook.Sheets[name] : null;
}

function sheetRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });
}

function findHeaderRow(rows, isHeader) {
  return rows.findIndex((row) =>
    row.some((cell) => typeof cell === "string" && isHeader(cell)),
  );
}

function headerIndex(header, matcher) {
  return header.findIndex(
    (cell) => typeof cell === "string" && matcher(cell.trim()),
  );
}

function readFrames(workbook) {
  const sheet = findSheet(workbook, (name) => /frames?/i.test(name));
  if (!sheet) return [];

  const rows = sheetRows(sheet);
  const headerIndexNumber = findHeaderRow(rows, (cell) =>
    /sample[\s_]*price/i.test(cell),
  );
  if (headerIndexNumber === -1) {
    throw new Error("Frames sheet: could not find the 'Sample Price' header row");
  }

  const header = rows[headerIndexNumber];
  const brandColumn = headerIndex(header, (cell) => /^frames?$/i.test(cell) || /^brand$/i.test(cell));
  const priceColumn = headerIndex(header, (cell) => /sample[\s_]*price/i.test(cell));
  const unitCostColumn = headerIndex(header, (cell) => /unit[\s_]*cost/i.test(cell));
  let stockColumn = headerIndex(
    header,
    (cell) => /^beg\.?$/i.test(cell) || /^beginning$/i.test(cell),
  );
  if (stockColumn === -1) {
    stockColumn = headerIndex(header, (cell) => /^ending$/i.test(cell));
  }
  const modelColumn = headerIndex(
    header,
    (cell) => /^model[\s_]*number$/i.test(cell) || /^model[\s_]*no\.?$/i.test(cell),
  );
  const colorColumn = headerIndex(header, (cell) => /^colou?r$/i.test(cell));
  const frameTypeColumn = headerIndex(header, (cell) => /frame[\s_]*type/i.test(cell));
  const materialColumn = headerIndex(header, (cell) => /^material$/i.test(cell));
  const genderColumn = headerIndex(header, (cell) => /^gender$/i.test(cell));
  const lensWidthColumn = headerIndex(header, (cell) => /lens[\s_]*width/i.test(cell));
  const bridgeWidthColumn = headerIndex(header, (cell) => /bridge[\s_]*width/i.test(cell));
  const templeLengthColumn = headerIndex(header, (cell) => /temple[\s_]*length/i.test(cell));

  if (brandColumn === -1 || priceColumn === -1) {
    throw new Error("Frames sheet: could not locate the 'Frames' or 'Sample Price' column");
  }

  const items = [];
  for (let r = headerIndexNumber + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const brand = cleanText(row[brandColumn]);
    if (!brand) continue;
    items.push({
      rowNumber: r + 1,
      brand,
      modelNumber:
        modelColumn === -1 ? null : cleanText(row[modelColumn]) || null,
      price: parseNumber(row[priceColumn]),
      unitCost:
        unitCostColumn === -1 ? null : parseNullableNumber(row[unitCostColumn]),
      quantity:
        stockColumn === -1 ? null : parseNullableNumber(row[stockColumn]),
      color: colorColumn === -1 ? null : cleanText(row[colorColumn]) || null,
      frameType:
        frameTypeColumn === -1 ? null : cleanText(row[frameTypeColumn]) || null,
      material:
        materialColumn === -1 ? null : cleanText(row[materialColumn]) || null,
      gender: genderColumn === -1 ? null : parseGender(row[genderColumn]),
      lensWidth:
        lensWidthColumn === -1 ? null : parseNullableNumber(row[lensWidthColumn]),
      bridgeWidth:
        bridgeWidthColumn === -1 ? null : parseNullableNumber(row[bridgeWidthColumn]),
      templeLength:
        templeLengthColumn === -1
          ? null
          : parseNullableNumber(row[templeLengthColumn]),
    });
  }

  return buildFrameCodes(items);
}

function buildFrameCodes(rawItems) {
  const sequenceBySlug = new Map();

  return rawItems.map((item) => {
    const slug = slugifyBrand(item.brand);
    const sequence = (sequenceBySlug.get(slug) ?? 0) + 1;
    sequenceBySlug.set(slug, sequence);
    const code = `${slug}-${String(sequence).padStart(3, "0")}`;
    const modelNumber = item.modelNumber || code;

    return {
      ...item,
      code: modelNumber,
      sku: modelNumber,
      modelNumber,
    };
  });
}

function readLenses(workbook) {
  const sheet = findSheet(workbook, (name) => /lenses?/i.test(name));
  if (!sheet) return [];

  const rows = sheetRows(sheet);
  const headerIndexNumber = findHeaderRow(rows, (cell) =>
    /^sku$/i.test(cell),
  );
  if (headerIndexNumber === -1) {
    throw new Error("Lenses sheet: could not find the 'sku' header row");
  }

  const header = rows[headerIndexNumber];
  const column = (matcher) => headerIndex(header, matcher);
  const skuColumn = column((cell) => /^sku$/i.test(cell));
  const brandColumn = column((cell) => /^brand$/i.test(cell));
  const lensTypeColumn = column((cell) => /lens[\s_]*type/i.test(cell));
  const materialColumn = column((cell) => /^material$/i.test(cell));
  const indexColumn = column((cell) => /index/i.test(cell));
  const coatingColumn = column((cell) => /coating/i.test(cell));
  const minSphereColumn = column((cell) => /min[\s_]*sphere/i.test(cell));
  const maxSphereColumn = column((cell) => /max[\s_]*sphere/i.test(cell));
  const minCylinderColumn = column((cell) => /min[\s_]*cylinder/i.test(cell));
  const maxCylinderColumn = column((cell) => /max[\s_]*cylinder/i.test(cell));
  const unitCostColumn = column((cell) => /unit[\s_]*cost/i.test(cell));
  const priceColumn = column((cell) => /selling[\s_]*price/i.test(cell));
  const quantityColumn = column((cell) => /^quantity$/i.test(cell));
  const reorderColumn = column((cell) => /reorder[\s_]*level/i.test(cell));
  const activeColumn = column((cell) => /is[\s_]*active/i.test(cell));

  if (
    skuColumn === -1 ||
    brandColumn === -1 ||
    lensTypeColumn === -1 ||
    materialColumn === -1
  ) {
    throw new Error(
      "Lenses sheet: 'sku', 'brand', 'lens_type' and 'material' columns are required",
    );
  }

  const pick = (row, index) => (index === -1 ? null : row[index]);
  const items = [];

  for (let r = headerIndexNumber + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const sku = cleanText(pick(row, skuColumn));
    const brand = cleanText(pick(row, brandColumn));
    const lensType = cleanText(pick(row, lensTypeColumn));
    if (!sku || !brand || !lensType) continue;

    items.push({
      rowNumber: r + 1,
      sku,
      brand,
      lensType,
      material: cleanText(pick(row, materialColumn)),
      indexValue: parseNullableNumber(pick(row, indexColumn)),
      coating: cleanText(pick(row, coatingColumn)) || null,
      minSphere: parseNullableNumber(pick(row, minSphereColumn)),
      maxSphere: parseNullableNumber(pick(row, maxSphereColumn)),
      minCylinder: parseNullableNumber(pick(row, minCylinderColumn)),
      maxCylinder: parseNullableNumber(pick(row, maxCylinderColumn)),
      unitCost: parseNumber(pick(row, unitCostColumn)),
      sellingPrice: parseNumber(pick(row, priceColumn)),
      quantity: parseNumber(pick(row, quantityColumn)),
      reorderLevel:
        reorderColumn === -1
          ? 5
          : parseNumber(pick(row, reorderColumn)),
      isActive: parseBoolean(pick(row, activeColumn), true),
    });
  }

  return items;
}

async function upsertFrame(client, item, options) {
  const existing = await client.query(
    "SELECT id, frame_id FROM inventory WHERE sku = $1",
    [item.sku],
  );

  let frameId = existing.rows[0]?.frame_id ?? null;

  if (!frameId) {
    const match = await client.query(
      "SELECT id FROM frames WHERE brand = $1 AND model_number = $2 ORDER BY id LIMIT 1",
      [item.brand, item.modelNumber],
    );
    frameId = match.rows[0]?.id ?? null;
  }

  if (frameId) {
    await client.query(
      `
      UPDATE frames
      SET brand = $1,
          model_number = $2,
          color = COALESCE($3, color),
          frame_type = COALESCE($4, frame_type),
          material = COALESCE($5, material),
          gender = COALESCE($6::frame_gender, gender),
          lens_width = COALESCE($7, lens_width),
          bridge_width = COALESCE($8, bridge_width),
          temple_length = COALESCE($9, temple_length),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      `,
      [
        item.brand,
        item.modelNumber,
        item.color,
        item.frameType,
        item.material,
        item.gender,
        item.lensWidth,
        item.bridgeWidth,
        item.templeLength,
        frameId,
      ],
    );
  } else {
    const inserted = await client.query(
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
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::frame_gender, 'unisex'), $7, $8, $9)
      RETURNING id
      `,
      [
        item.brand,
        item.modelNumber,
        item.color,
        item.frameType,
        item.material,
        item.gender,
        item.lensWidth,
        item.bridgeWidth,
        item.templeLength,
      ],
    );
    frameId = inserted.rows[0].id;
  }

  const quantityUpdate = options.updateStock
    ? "EXCLUDED.quantity"
    : "inventory.quantity";

  await client.query(
    `
    INSERT INTO inventory (
      sku,
      category,
      frame_id,
      quantity,
      reorder_level,
      unit_cost,
      selling_price
    )
    VALUES ($1, 'frame', $2, $3, $4, $5, $6)
    ON CONFLICT (sku) DO UPDATE SET
      category = 'frame',
      frame_id = EXCLUDED.frame_id,
      unit_cost = EXCLUDED.unit_cost,
      selling_price = EXCLUDED.selling_price,
      quantity = ${quantityUpdate},
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      item.sku,
      frameId,
      item.quantity ?? options.quantity,
      options.reorderLevel,
      item.unitCost ?? options.unitCost,
      item.price,
    ],
  );

  return existing.rowCount > 0 ? "updated" : "inserted";
}

async function upsertLens(client, item, options) {
  const existing = await client.query(
    "SELECT id, lens_id FROM inventory WHERE sku = $1",
    [item.sku],
  );

  let lensId = existing.rows[0]?.lens_id ?? null;

  if (!lensId) {
    const match = await client.query(
      `
      SELECT id FROM lenses
      WHERE brand = $1
        AND lens_type = $2
        AND material = $3
        AND index_value IS NOT DISTINCT FROM $4
        AND coating IS NOT DISTINCT FROM $5
      ORDER BY id
      LIMIT 1
      `,
      [item.brand, item.lensType, item.material, item.indexValue, item.coating],
    );
    lensId = match.rows[0]?.id ?? null;
  }

  if (lensId) {
    await client.query(
      `
      UPDATE lenses
      SET brand = $1,
          lens_type = $2,
          material = $3,
          index_value = $4,
          coating = $5,
          min_sphere = $6,
          max_sphere = $7,
          min_cylinder = $8,
          max_cylinder = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      `,
      [
        item.brand,
        item.lensType,
        item.material,
        item.indexValue,
        item.coating,
        item.minSphere,
        item.maxSphere,
        item.minCylinder,
        item.maxCylinder,
        lensId,
      ],
    );
  } else {
    const inserted = await client.query(
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
      RETURNING id
      `,
      [
        item.brand,
        item.lensType,
        item.material,
        item.indexValue,
        item.coating,
        item.minSphere,
        item.maxSphere,
        item.minCylinder,
        item.maxCylinder,
      ],
    );
    lensId = inserted.rows[0].id;
  }

  const quantityUpdate = options.updateStock
    ? "EXCLUDED.quantity"
    : "inventory.quantity";
  const reorderUpdate = options.updateStock
    ? "EXCLUDED.reorder_level"
    : "inventory.reorder_level";

  await client.query(
    `
    INSERT INTO inventory (
      sku,
      category,
      lens_id,
      quantity,
      reorder_level,
      unit_cost,
      selling_price,
      is_active
    )
    VALUES ($1, 'lens', $2, $3, $4, $5, $6, $7)
    ON CONFLICT (sku) DO UPDATE SET
      category = 'lens',
      lens_id = EXCLUDED.lens_id,
      unit_cost = EXCLUDED.unit_cost,
      selling_price = EXCLUDED.selling_price,
      is_active = EXCLUDED.is_active,
      quantity = ${quantityUpdate},
      reorder_level = ${reorderUpdate},
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      item.sku,
      lensId,
      item.quantity,
      item.reorderLevel,
      item.unitCost,
      item.sellingPrice,
      item.isActive,
    ],
  );

  return existing.rowCount > 0 ? "updated" : "inserted";
}

async function importItems({ frames, lenses }, options) {
  const connectionString = process.env.DATABASE_URL_NEON;
  if (!connectionString) {
    throw new Error("DATABASE_URL_NEON is not set in the backend .env file");
  }

  const pool = new pg.Pool({
    connectionString,
    options: `-c timezone=${process.env.APP_TIMEZONE || "Asia/Manila"}`,
  });

  const client = await pool.connect();
  const stats = {
    frames: { inserted: 0, updated: 0 },
    lenses: { inserted: 0, updated: 0 },
  };

  try {
    await client.query("BEGIN");

    for (const item of frames) {
      const result = await upsertFrame(client, item, options);
      stats.frames[result] += 1;
    }

    for (const item of lenses) {
      const result = await upsertLens(client, item, options);
      stats.lenses[result] += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  return stats;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`Reading: ${options.file}`);
  const workbook = XLSX.readFile(options.file);
  const frames = readFrames(workbook);
  const lenses = readLenses(workbook);

  console.log(`Frames found: ${frames.length}`);
  console.log(`Lenses found: ${lenses.length}`);
  console.log(
    `Frame defaults: quantity=${options.quantity}, reorder_level=${options.reorderLevel}, unit_cost_fallback=${options.unitCost}`,
  );
  console.log(
    `Lens stock: ${options.updateStock ? "refresh quantity/reorder from sheet" : "preserve existing quantities"}`,
  );
  console.log("Products sheet: skipped (frame + lens packages are not imported).");

  if (options.dryRun) {
    console.log("\n[dry run] No database changes were made.");
    console.log("First 5 frames:");
    for (const item of frames.slice(0, 5)) {
      console.log(
        `  ${item.sku.padEnd(24)} ${item.brand.padEnd(24)} price=${item.price} cost=${item.unitCost ?? options.unitCost}`,
      );
    }
    console.log("First 5 lenses:");
    for (const item of lenses.slice(0, 5)) {
      console.log(
        `  ${item.sku.padEnd(24)} ${item.brand.padEnd(20)} ${item.lensType.padEnd(16)} qty=${item.quantity} price=${item.sellingPrice}`,
      );
    }
    if (frames.length > 5) console.log(`  ...and ${frames.length - 5} more frames`);
    if (lenses.length > 5) console.log(`  ...and ${lenses.length - 5} more lenses`);
    return;
  }

  const stats = await importItems({ frames, lenses }, options);
  console.log("\nImport complete.");
  console.log(
    `  Frames: ${stats.frames.inserted} inserted, ${stats.frames.updated} updated`,
  );
  console.log(
    `  Lenses: ${stats.lenses.inserted} inserted, ${stats.lenses.updated} updated`,
  );
}

main().catch((error) => {
  console.error("\nImport failed:", error.message);
  process.exitCode = 1;
});
