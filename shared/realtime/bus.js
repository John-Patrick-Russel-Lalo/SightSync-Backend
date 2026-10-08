// Small indirection so the notification and doctor-status services can push
// realtime events without importing the socket server (which already imports
// the notification service).
let emitter = () => false;
let allEmitter = () => false;

export function setEmitter(fn) {
    emitter = typeof fn === "function" ? fn : () => false;
}

export function setAllEmitter(fn) {
    allEmitter = typeof fn === "function" ? fn : () => false;
}

export function emitToUser(userId, event, payload) {
    if (userId === null || userId === undefined) return false;
    return emitter(userId, event, payload);
}

export function emitToAll(event, payload) {
    return allEmitter(event, payload);
}
