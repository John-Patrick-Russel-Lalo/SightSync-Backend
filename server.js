import 'dotenv/config';
import http from "http";
import app from "./app.js";
import { initRealtime } from "./shared/realtime/socket.js";

const PORT = process.env.PORT || 3500;

const server = http.createServer(app);

initRealtime(server);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
