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
    const client = await pool.connect(); // Grab a dedicated client for the transaction
    
    try {
        await client.query("BEGIN"); // Start transaction

        // 1. Create the user
        const userResult = await client.query(
            `
            INSERT INTO users (provider, provider_id, email, username, display_name, role, avatar_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                user.provider,
                user.providerId,
                user.email,
                user.username,
                user.displayName,
                "patient",
                user.avatar
            ]
        );
        const newUser = userResult.rows[0];

        // 2. Automatically create empty patient profile if role is 'patient'
        if (newUser.role === 'patient') {
            await client.query(
                `INSERT INTO patient_profiles (user_id) VALUES ($1)`,
                [newUser.id]
            );
        }

        await client.query("COMMIT"); // Save both queries to the database
        return newUser;
        
    } catch (error) {
        await client.query("ROLLBACK"); // Undo everything if there's an error
        throw error;
    } finally {
        client.release(); // Return client to the pool
    }
}

export async function createUser(email, username, password) {
    const client = await pool.connect(); 
    
    try {
        await client.query("BEGIN");

        // 1. Create the user
        const hashedPassword = await bcrypt.hash(password, 10);
        const userResult = await client.query(
            `
            INSERT INTO users (provider, email, username, password, role) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
            `,
            ["local", email, username, hashedPassword, "patient"]
        );
        const newUser = userResult.rows[0];

        // 2. Automatically create the empty patient profile shell
        await client.query(
            `INSERT INTO patient_profiles (user_id) VALUES ($1)`,
            [newUser.id]
        );

        await client.query("COMMIT"); 
        return newUser;
        
    } catch (error) {
        await client.query("ROLLBACK"); 
        throw error;
    } finally {
        client.release(); 
    }
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