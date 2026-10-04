import {
    listNotifications,
    markReadForUser,
    markAllReadForUser
} from "./notification.service.js";

export async function getMyNotifications(req, res) {
    try {
        const userId = req.user.id;
        const notifications = await listNotifications(userId);
        res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function markRead(req, res) {
    try {
        const { id } = req.params;
        const updated = await markReadForUser(req.user.id, id);
        if (!updated) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.status(200).json({ message: "Notification marked as read", notification: updated });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function markAllRead(req, res) {
    try {
        const userId = req.user.id;
        const { updated } = await markAllReadForUser(userId);
        res.status(200).json({ message: "All notifications marked as read", updated });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
}
