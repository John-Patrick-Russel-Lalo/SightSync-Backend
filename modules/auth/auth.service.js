import pool from "../../shared/config/db.js";

export async function uniqueEmailValidator(req, res) {
  try {
    const result = await pool.query("SELECT email FROM users WHERE email = $1", [req.body.email]);
    if (result.rows.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }
    return res.status(200).json({ message: "Email is valid" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

export default { uniqueEmailValidator };
