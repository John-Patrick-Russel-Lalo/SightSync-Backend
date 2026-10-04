import {
    getNotificationsByUserId,
    createNotification,
    markNotificationAsReadForUser,
    markAllNotificationsAsRead
} from "./notification.model.js";
import { emitToUser } from "../../shared/realtime/bus.js";

export function listNotifications(userId) {
    return getNotificationsByUserId(userId);
}

// Persists a notification and pushes it to every live connection of the
// recipient so the bell updates without a refetch.
export async function sendNotification(userId, title, detail) {
    const notification = await createNotification(userId, title, detail);
    emitToUser(userId, "notification:new", { notification });
    return notification;
}

// Scoped to the owner: a user can never flip another user's notification.
export async function markReadForUser(userId, id) {
    const updated = await markNotificationAsReadForUser(id, userId);
    if (!updated) return null;

    emitToUser(userId, "notification:read", { notification: updated });
    return updated;
}

export async function markAllReadForUser(userId) {
    const { rowCount } = await markAllNotificationsAsRead(userId);

    emitToUser(userId, "notifications:read-all", { updated: rowCount || 0 });
    return { updated: rowCount || 0 };
}
