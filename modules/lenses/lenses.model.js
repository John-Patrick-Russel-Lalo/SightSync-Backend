import pool from "../../shared/config/db.js";


export async function getAllLenses() {
    const result = await pool.query(
        `
        SELECT *
        FROM lenses
        `
    );

    return result.rows;
}


