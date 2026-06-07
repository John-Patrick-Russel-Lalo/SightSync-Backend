import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const result = await pool.query("SELECT NOW()");
  console.log("Database Connected");
  console.log(result.rows[0]);
} catch (err) {
  console.error(err);
}

export default pool;