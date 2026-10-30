/**
 * Import the Balayan frames workbook into the SightSync database.
 *
 * Source : Balayan_Frames_Inventory_2026_Sample_Prices.xlsx
 * Sheet  : "Frames Inventory" (brand in column A, sample price in column B)
 * Targets: frames, inventory
 *
 * The workbook only contains a frame brand and a sample selling price. Stock
 * columns (BEG. / IN / 1..31 / Ending) are empty in the source file, so every
 * imported item starts at 0 quantity.
 *
 * Each frame gets a deterministic model number / SKU built from a brand slug
 * plus a per-brand sequence, e.g. RAYBAN-001, RAYBAN-002. Re-running the script
 * is safe: rows whose SKU already exists in inventory are skipped.
 *
 * Usage (from the backend folder):
 *   node scripts/importBalayanFrames.js
 *   node scripts/importBalayanFrames.js --dry-run
 *   node scripts/importBalayanFrames.js --file "C:\path\to\file.xlsx"
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
  "../../Balayan_Frames_Inventory_2026_Sample_Prices.xlsx",
);
const SHEET_NAME = "Frames Inventory";

function parseArgs(argv) {
  const args = {
    file: DEFAULT_FILE,
    dryRun: false,
    quantity: 0,
    reorderLevel: 5,
    unitCost: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
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
        "Usage: node scripts/importBalayanFrames.js [--file <xlsx>] [--dry-run] [--quantity <n>] [--reorder-level <n>] [--unit-cost <n>]",
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

function cleanBrand(value) {
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

function parsePrice(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readWorkbook(file) {
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[SHEET_NAME] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${file}`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const headerIndex = rows.findIndex((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" && /sample\s*price/i.test(cell),
    ),
  );
  if (headerIndex === -1) {
    throw new Error("Could not find the header row (expected a 'Sample Price' column)");
  }

  const header = rows[headerIndex];
  const brandColumn = header.findIndex(
    (cell) => typeof cell === "string" && /^frames?$/i.test(cell.trim()),
  );
  const priceColumn = header.findIndex(
    (cell) => typeof cell === "string" && /sample\s*price/i.test(cell),
  );

  if (brandColumn === -1 || priceColumn === -1) {
    throw new Error("Could not locate the 'Frames' or 'Sample Price' column");
  }

  const items = [];
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const brand = cleanBrand(row[brandColumn]);
    if (!brand) continue;
    items.push({ rowNumber: r + 1, brand, price: parsePrice(row[priceColumn]) });
  }

  return items;
}

function buildItems(rawItems) {
  const sequenceBySlug = new Map();

  return rawItems.map((item) => {
    const slug = slugifyBrand(item.brand);
    const sequence = (sequenceBySlug.get(slug) ?? 0) + 1;
    sequenceBySlug.set(slug, sequence);
    const code = `${slug}-${String(sequence).padStart(3, "0")}`;

    return {
      ...item,
      code,
      sku: code,
      modelNumber: code,
    };
  });
}

async function importItems(items, options) {
  const connectionString = process.env.DATABASE_URL_NEON;
  if (!connectionString) {
    throw new Error("DATABASE_URL_NEON is not set in the backend .env file");
  }

  const pool = new pg.Pool({
    connectionString,
    options: `-c timezone=${process.env.APP_TIMEZONE || "Asia/Manila"}`,
  });

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    for (const item of items) {
      const existing = await client.query(
        "SELECT id FROM inventory WHERE sku = $1",
        [item.sku],
      );
      if (existing.rowCount > 0) {
        skipped += 1;
        continue;
      }

      const frameResult = await client.query(
        `
        INSERT INTO frames (brand, model_number)
        VALUES ($1, $2)
        RETURNING id
        `,
        [item.brand, item.modelNumber],
      );
      const frameId = frameResult.rows[0].id;

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
        `,
        [
          item.sku,
          frameId,
          options.quantity,
          options.reorderLevel,
          options.unitCost,
          item.price,
        ],
      );

      inserted += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  return { inserted, skipped };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`Reading: ${options.file}`);
  const rawItems = readWorkbook(options.file);
  const items = buildItems(rawItems);

  console.log(`Frames found: ${items.length}`);
  console.log(
    `Inventory defaults: quantity=${options.quantity}, reorder_level=${options.reorderLevel}, unit_cost=${options.unitCost}`,
  );

  if (options.dryRun) {
    console.log("\n[dry run] No database changes were made. First 10 items:");
    for (const item of items.slice(0, 10)) {
      console.log(
        `  ${item.sku.padEnd(24)} ${item.brand.padEnd(24)} price=${item.price}`,
      );
    }
    if (items.length > 10) console.log(`  ...and ${items.length - 10} more`);
    return;
  }

  const { inserted, skipped } = await importItems(items, options);
  console.log("\nImport complete.");
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (SKU already exists): ${skipped}`);
}

main().catch((error) => {
  console.error("\nImport failed:", error.message);
  process.exitCode = 1;
});
