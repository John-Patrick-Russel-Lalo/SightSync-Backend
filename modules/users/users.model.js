

import pool from "../../shared/config/db.js";
import validator from "validator";
import bcrypt from "bcrypt";

export async function findUserById(id) {
    const result = await pool.query(
        `
        SELECT *
        FROM users
        WHERE id = $1
        `,
        [id]
    );

    return result.rows[0];
}


export async function deleteUserById(id) {
    await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
        `,
        [id]
    );
}

export async function updateUserById(id, updates) {
    const fields = [];
    const values = [];
    let index = 1;

    for (const key in updates) {
        fields.push(`${key} = $${index}`);
        values.push(updates[key]);
        index++;
    }

    await pool.query(
        `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = $${index}
        `,
        [...values, id]
    )
}

export async function getRoleById(roleId) {
    const result = await pool.query(
        `
        SELECT *
        FROM users
        WHERE id = $1
        `,
        [roleId]
    );

    return result.rows[0];
}