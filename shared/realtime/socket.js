import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import allowedOrigins from "../config/cors.js";
import { parseCookieHeader } from "../utils/cookies.js";
import { setEmitter, setAllEmitter } from "./bus.js";
import {
    listNotifications,
    markReadForUser,
    markAllReadForUser
} from "../../modules/notification/notification.service.js";
import { getDoctorStatusSnapshot } from "../../modules/doctor_management/doctorStatus.service.js";

let io = null;

export function userRoom(userId) {
    return `user:${userId}`;
}

function authenticateSocket(socket, next) {
    const cookies = parseCookieHeader(socket.handshake.headers?.cookie);
    const token = cookies.token;

    if (!token) {
        return next(new Error("Unauthorized: missing token"));
    }

    try {
        socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        next(new Error("Unauthorized: invalid token"));
    }
}

export function initRealtime(httpServer) {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: allowedOrigins,
            credentials: true,
        },
        // Prefer a real WebSocket, fall back to polling if the upgrade is blocked.
        transports: ["websocket", "polling"],
    });

    // Let the notification service push events without importing this module.
    setEmitter((userId, event, payload) => {
        io.to(userRoom(userId)).emit(event, payload);
        return true;
    });

    // Let the doctor-status service broadcast presence to every connected
    // client (patients watch this on the booking page).
    setAllEmitter((event, payload) => {
        io.emit(event, payload);
        return true;
    });

    io.use(authenticateSocket);

    io.on("connection", async (socket) => {
        const user = socket.data.user;
        const userId = user.id;

        socket.join(userRoom(userId));

        // Push the current state the moment the client connects so the UI can
        // render without waiting for a separate HTTP request.
        try {
            const notifications = await listNotifications(userId);
            socket.emit("notifications:snapshot", { notifications });
        } catch (error) {
            console.error("Failed to send notification snapshot:", error);
            socket.emit("notifications:snapshot", { notifications: [] });
        }

        // Doctor presence for the booking page, pushed on connect the same way.
        try {
            const statuses = await getDoctorStatusSnapshot();
            socket.emit("doctor:status:snapshot", { statuses });
        } catch (error) {
            console.error("Failed to send doctor status snapshot:", error);
            socket.emit("doctor:status:snapshot", { statuses: {} });
        }

        socket.on("notifications:list", async (ack) => {
            try {
                const notifications = await listNotifications(userId);
                respond(ack, { ok: true, notifications });
            } catch (error) {
                console.error("Failed to list notifications:", error);
                respond(ack, { ok: false, message: "Failed to load notifications" });
            }
        });

        socket.on("notifications:mark-read", async ({ id } = {}, ack) => {
            try {
                const updated = await markReadForUser(userId, id);
                if (!updated) {
                    return respond(ack, { ok: false, message: "Notification not found" });
                }
                respond(ack, { ok: true, notification: updated });
            } catch (error) {
                console.error("Failed to mark notification as read:", error);
                respond(ack, { ok: false, message: "Failed to mark notification as read" });
            }
        });

        socket.on("notifications:mark-all-read", async (ack) => {
            try {
                const result = await markAllReadForUser(userId);
                respond(ack, { ok: true, ...result });
            } catch (error) {
                console.error("Failed to mark all notifications as read:", error);
                respond(ack, { ok: false, message: "Failed to mark all notifications as read" });
            }
        });

        socket.on("notifications:ping", (ack) => respond(ack, { ok: true }));
    });

    return io;
}

function respond(ack, payload) {
    if (typeof ack === "function") ack(payload);
}

export function getIO() {
    return io;
}
