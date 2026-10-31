/**
 * Import the Balayan "Transaction History" sheet into the SightSync sales table.
 *
 * Source : Balayan_Frames_Lenses_Products_Inventory_2026(1).xlsx
 * Sheet  : "Transaction History" -> sales (receipt headers only)
 *
 * The workbook stores receipt totals but no per-line items, so this imports the
 * sales header only (no sale_items rows). Receipts, totals, payment method,
 * status, cashier and sale date are preserved. Re-running is safe: existing
 * receipt numbers are skipped.
 *
 * Usage (from the backend folder):
 *   node scripts/importBalayanSales.js
 *   node scripts/importBalayanSales.js --dry-run
 *   node scripts/importBalayanSales.js --file "C:\path\to\file.xlsx"
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

function parseArgs(argv) {
  const args = { file: DEFAULT_FILE, dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--file") {
      args.file = path.resolve(argv[(i += 1)]);
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/importBalayanSales.js [--file <xlsx>] [--dry-run]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePayment(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized.includes("card")) return "card";
  if (normalized.includes("qr")) return "qr";
  return "cash";
}

function normalizeStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "voided") return "voided";
  if (normalized === "refunded") return "refunded";
  return "completed";
}

function formatTimestamp(value) {
  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      date = new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        Math.floor(parsed.S || 0),
      );
    }
  } else if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return null;

  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function findSheet(workbook, matcher) {
  const name = workbook.SheetNames.find((sheetName) => matcher(sheetName));
  return name ? workbook.Sheets[name] : null;
}

function headerIndex(header, matcher) {
  return header.findIndex(
    (cell) => typeof cell === "string" && matcher(cell.trim()),
  );
}

function readTransactions(workbook) {
  const sheet = findSheet(workbook, (name) => /transaction/i.test(name));
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const headerIndexNumber = rows.findIndex((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" && /receipt\s*no/i.test(cell.trim()),
    ),
  );
  if (headerIndexNumber === -1) {
    throw new Error("Transaction History sheet: could not find the 'Receipt No.' header row");
  }

  const header = rows[headerIndexNumber];
  const column = (matcher) => headerIndex(header, matcher);
  const receiptColumn = column((cell) => /receipt\s*no/i.test(cell));
  const customerColumn = column((cell) => /^customer$/i.test(cell));
  const paymentColumn = column((cell) => /^payment$/i.test(cell));
  const totalColumn = column((cell) => /^total$/i.test(cell));
  const statusColumn = column((cell) => /^status$/i.test(cell));
  const cashierColumn = column((cell) => /^cashier$/i.test(cell));
  const dateColumn = column((cell) => /^date$/i.test(cell));

  if (receiptColumn === -1 || totalColumn === -1) {
    throw new Error(
      "Transaction History sheet: 'Receipt No.' and 'Total' columns are required",
    );
  }

  const pick = (row, index) => (index === -1 ? null : row[index]);
  const items = [];

  for (let r = headerIndexNumber + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const receiptNumber = cleanText(pick(row, receiptColumn));
    if (!receiptNumber) continue;

    const total = parseNumber(pick(row, totalColumn));

    items.push({
      rowNumber: r + 1,
      receiptNumber,
      customerName: cleanText(pick(row, customerColumn)) || null,
      paymentMethod: normalizePayment(pick(row, paymentColumn)),
      total,
      status: normalizeStatus(pick(row, statusColumn)),
      cashier: cleanText(pick(row, cashierColumn)) || null,
      createdAt: formatTimestamp(pick(row, dateColumn)),
    });
  }

  return items;
}

function buildCashierResolver(users) {
  const byName = new Map();
  let firstAdminId = null;

  for (const user of users) {
    if (user.role === "admin" && firstAdminId === null) {
      firstAdminId = user.id;
    }
    for (const name of [user.username, user.display_name]) {
      const key = cleanText(name).toLowerCase();
      if (key && !byName.has(key)) byName.set(key, user.id);
    }
  }

  return (cashier) => {
    const key = cleanText(cashier).toLowerCase();
    if (key && byName.has(key)) return byName.get(key);
    if (key.includes("admin")) return firstAdminId;
    return null;
  };
}

async function importSales(items) {
  const connectionString = process.env.DATABASE_URL_NEON;
  if (!connectionString) {
    throw new Error("DATABASE_URL_NEON is not set in the backend .env file");
  }

  const pool = new pg.Pool({
    connectionString,
    options: `-c timezone=${process.env.APP_TIMEZONE || "Asia/Manila"}`,
  });

  const client = await pool.connect();
  const stats = { inserted: 0, skipped: 0 };

  try {
    await client.query("BEGIN");

    const usersRes = await client.query(
      "SELECT id, username, display_name, role FROM users",
    );
    const resolveCashier = buildCashierResolver(usersRes.rows);

    for (const item of items) {
      const result = await client.query(
        `
        INSERT INTO sales (
          receipt_number,
          customer_name,
          subtotal,
          discount_amount,
          tax_amount,
          total,
          payment_method,
          amount_tendered,
          change_amount,
          status,
          sold_by,
          created_at
        )
        VALUES ($1, $2, $3, 0, 0, $4, $5, NULL, NULL, $6, $7, $8)
        ON CONFLICT (receipt_number) DO NOTHING
        `,
        [
          item.receiptNumber,
          item.customerName,
          item.total,
          item.total,
          item.paymentMethod,
          item.status,
          resolveCashier(item.cashier),
          item.createdAt,
        ],
      );

      if (result.rowCount > 0) stats.inserted += 1;
      else stats.skipped += 1;
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
  const workbook = XLSX.readFile(options.file, { cellDates: true });
  const transactions = readTransactions(workbook);

  const completed = transactions.filter((t) => t.status === "completed");
  const netSales = completed.reduce((sum, t) => sum + t.total, 0);

  console.log(`Transactions found: ${transactions.length}`);
  console.log(
    `  completed=${completed.length} voided=${
      transactions.filter((t) => t.status === "voided").length
    } refunded=${transactions.filter((t) => t.status === "refunded").length}`,
  );
  console.log(`  completed net sales: ${netSales.toFixed(2)}`);

  if (options.dryRun) {
    console.log("\n[dry run] No database changes were made.");
    console.log("First 5 transactions:");
    for (const item of transactions.slice(0, 5)) {
      console.log(
        `  ${item.receiptNumber}  ${item.status.padEnd(9)} ${item.paymentMethod.padEnd(4)} total=${item.total} cashier=${item.cashier} at=${item.createdAt}`,
      );
    }
    if (transactions.length > 5) {
      console.log(`  ...and ${transactions.length - 5} more`);
    }
    return;
  }

  const stats = await importSales(transactions);
  console.log("\nImport complete.");
  console.log(`  Sales: ${stats.inserted} inserted, ${stats.skipped} skipped (already existed)`);
  console.log("  Note: sale_items are not imported (the workbook has no line items).");
}

main().catch((error) => {
  console.error("\nImport failed:", error.message);
  process.exitCode = 1;
});
