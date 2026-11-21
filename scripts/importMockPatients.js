/**
 * Imports patient accounts and profiles from SightSync_Mock_Patient_Accounts.xlsx.
 *
 * Usage from the backend folder:
 *   node scripts/importMockPatients.js --dry-run
 *   node scripts/importMockPatients.js
 *   node scripts/importMockPatients.js --file "C:\path\to\patients.xlsx"
 *
 * Existing email addresses are skipped, so the importer is safe to rerun.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import XLSX from "xlsx";
import bcrypt from "bcrypt";
import validator from "validator";
import { formatAccountName } from "../shared/utils/nameFormat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_FILE = path.resolve(__dirname, "../../SightSync_Mock_Patient_Accounts.xlsx");
const REQUIRED_COLUMNS = ["Email", "Temporary Password", "First Name", "Last Name", "Date of Birth", "Gender", "Phone Number"];
const VALID_GENDERS = new Set(["Male", "Female", "Other", "Prefer not to say"]);
const VALID_STATUSES = new Set(["active", "pending"]);

function parseArgs(argv) {
  let file = DEFAULT_FILE;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--file") file = path.resolve(argv[++i]);
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/importMockPatients.js [--dry-run] [--file <xlsx path>]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return { file, dryRun };
}

function clean(value) {
  return String(value ?? "").trim();
}

function validateRow(row, index) {
  for (const field of REQUIRED_COLUMNS) if (!clean(row[field])) throw new Error(`Row ${index}: ${field} is required.`);
  const email = clean(row.Email).toLowerCase();
  if (!validator.isEmail(email)) throw new Error(`Row ${index}: Email is invalid.`);
  if (clean(row["Temporary Password"]).length < 8) throw new Error(`Row ${index}: Temporary Password must have at least 8 characters.`);
  if (!VALID_GENDERS.has(clean(row.Gender))) throw new Error(`Row ${index}: Gender is invalid.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(row["Date of Birth"]))) throw new Error(`Row ${index}: Date of Birth must be YYYY-MM-DD.`);
  const status = clean(row["Account Status"]).toLowerCase() || "active";
  if (!VALID_STATUSES.has(status)) throw new Error(`Row ${index}: Account Status must be active or pending.`);
  return { ...row, Email: email, "Account Status": status };
}

const { file, dryRun } = parseArgs(process.argv.slice(2));
const workbook = XLSX.readFile(file, { cellDates: false });
const sheet = workbook.Sheets["Patient Accounts"];
if (!sheet) throw new Error('The workbook must contain a "Patient Accounts" worksheet.');
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, dateNF: "yyyy-mm-dd", range: 3 });
if (!rows.length) throw new Error("The workbook contains no patient records.");
for (const column of REQUIRED_COLUMNS) if (!Object.hasOwn(rows[0], column)) throw new Error(`Missing required column: ${column}`);
const patients = rows.map((row, index) => validateRow(row, index + 5));

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL_NEON });
const client = await pool.connect();
let inserted = 0;
let skipped = 0;
try {
  await client.query("BEGIN");
  for (const patient of patients) {
    const existing = await client.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [patient.Email]);
    if (existing.rows.length) { skipped += 1; continue; }
    const password = await bcrypt.hash(clean(patient["Temporary Password"]), 10);
    const username = formatAccountName(`${clean(patient["First Name"])} ${clean(patient["Last Name"])}`);
    const created = await client.query(
      `INSERT INTO users (provider, email, username, display_name, password, role, status)
       VALUES ('local', $1, $2, $3, $4, 'patient', $5) RETURNING id`,
      [patient.Email, username, username, password, patient["Account Status"]],
    );
    await client.query(
      `INSERT INTO patient_profiles (
        user_id, date_of_birth, gender, phone_number, blood_type,
        emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number
      ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)`,
      [
        created.rows[0].id, clean(patient["Date of Birth"]), clean(patient.Gender), clean(patient["Phone Number"]),
        clean(patient["Blood Type"]) || null, clean(patient["Emergency Contact Name"]) || null,
        clean(patient["Emergency Contact Phone"]) || null, clean(patient["Insurance Provider"]) || null,
        clean(patient["Insurance Policy Number"]) || null,
      ],
    );
    inserted += 1;
  }
  if (dryRun) await client.query("ROLLBACK"); else await client.query("COMMIT");
  console.log(`${dryRun ? "Dry run completed" : "Import completed"}: ${inserted} patient accounts ${dryRun ? "would be created" : "created"}; ${skipped} existing emails skipped.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
