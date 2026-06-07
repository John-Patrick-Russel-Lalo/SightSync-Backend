import pool from "../../shared/config/db.js";
import validator from "validator";
import bcrypt from "bcrypt";


export async function findUserByProvider(provider, providerId) {
    const result = await pool.query(
        `
        SELECT *
        FROM users
        WHERE provider = $1
        AND provider_id = $2
        `,
        [provider, providerId]
    );

    return result.rows[0];
}

export async function createUserByProvider(user) {
    const result = await pool.query(
        `
        INSERT INTO users
        (
            provider,
            provider_id,
            email,
            username,
            display_name,
            role,
            avatar_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
            user.provider,
            user.providerId,
            user.email,
            user.username,
            user.displayName,
            user.role,
            user.avatar
        ]
    );

    return result.rows[0];
}

export async function createUser(email, username, password) {

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
        `INSERT INTO users (provider, email, username, password, role) values ($1, $2, $3, $4, $5) RETURNING *`,
        ["local", email, username, hashedPassword, "user"]
    );
    return result.rows[0];
}

export async function loginUser(email, password) {
    const result = await pool.query(
        `SELECT * FROM users WHERE email = $1 AND provider = $2`,
        [email, "local"]
    );
    const user = result.rows[0];
    if (!user) {
        return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return null;
    }
    return user;
}
