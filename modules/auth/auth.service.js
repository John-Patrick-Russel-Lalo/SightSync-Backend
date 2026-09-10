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


// Check existing user by email
export async function findUserByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

// Link an existing account to an OAuth provider ID
export async function linkProviderToUser(userId, provider, providerId) {
  // Example SQL assumption (e.g. google_id, github_id, facebook_id columns)
  const providerColumn = `${provider}_id`; 
  
  const result = await pool.query(
    `UPDATE users SET ${providerColumn} = $1 WHERE id = $2 RETURNING *`,
    [providerId, userId]
  );
  return result.rows[0];
}

export default { uniqueEmailValidator };
