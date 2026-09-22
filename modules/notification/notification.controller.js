import {
    getNotificationsByUserId,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from "./notification.model.js";

export async function getMyNotifications(req, res) {
    try {
        const userId = req.user.id;
        const notifications = await getNotificationsByUserId(userId);
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
        const updated = await markNotificationAsRead(id);
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
        await markAllNotificationsAsRead(userId);
        res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
}
