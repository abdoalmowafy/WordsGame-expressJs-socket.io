require('dotenv').config();
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { connectToRedis } from "./redis";
import MapSockets from "./events/sockets";

const app = express();
// app.use(cors({
//     origin: "*",
//     methods: ["GET", "POST"],
//     credentials: true
// }));

const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

server.listen({
    port: PORT,
    host: '0.0.0.0'
}, async () => {
    await connectToRedis();
    console.log(`Server listening on port ${PORT}`);
});

io.on("connection", async (socket: Socket) => {
    MapSockets(io, socket);
});
