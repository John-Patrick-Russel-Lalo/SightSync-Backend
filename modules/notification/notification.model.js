import pool from "../../shared/config/db.js";

export async function getNotificationsByUserId(userId) {
    const result = await pool.query(
        `
        SELECT *
        FROM notifications
        WHERE user_id = $1
        ORDER BY time DESC
        `,
        [userId]
    );
    return result.rows;
}

export async function createNotification(userId, title, detail) {
    const result = await pool.query(
        `
        INSERT INTO notifications (user_id, title, detail)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [userId, title, detail]
    );
    return result.rows[0];
}

export async function markNotificationAsRead(id) {
    const result = await pool.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = $1
        RETURNING *
        `,
        [id]
    );
    return result.rows[0];
}

export async function markAllNotificationsAsRead(userId) {
    await pool.query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = $1
        `,
        [userId]
    );
}
