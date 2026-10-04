// Small indirection so the notification service can push realtime events
// without importing the socket server (which already imports the service).
let emitter = () => false;

export function setEmitter(fn) {
    emitter = typeof fn === "function" ? fn : () => false;
}

export function emitToUser(userId, event, payload) {
    if (userId === null || userId === undefined) return false;
    return emitter(userId, event, payload);
}
