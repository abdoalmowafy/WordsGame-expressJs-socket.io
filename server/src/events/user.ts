import { Server, Socket } from "socket.io";
import redis from "../redis";
import { leaveRoom } from "./room";
import { tryStartRound } from "./round";
import player from "../models/player";

async function connect(io: Server, socket: Socket) {
    await redis.sAdd("players", socket.id)
    const player: player = {
        id: socket.id,
        name: socket.id,
        currentRoomName: "",
        status: "waiting"
    };
    await redis.hSet(`player-${socket.id}`, player);

    console.log(`a user connected with id ${socket.id} and IP ${socket.handshake.address}`);
}

async function disconnect(io: Server, socket: Socket) {
    await redis.sRem("players", socket.id);
    await redis.del(`player-${socket.id}`);

    console.warn(`user disconnected with id ${socket.id} and IP ${socket.handshake.address}`);
}

const userEvents = (io: Server, socket: Socket) => {
    connect(io, socket);

    socket.on("disconnect", async () => {
        await leaveRoom(io, socket);
        await disconnect(io, socket);
    });

    socket.on("changeName", async (name: string) => {
        name = name.trim();

        if (name.length < 3) {
            socket.emit("error", "Name must be at least 3 characters long");
            return;
        }

        await redis.hSet(`player-${socket.id}`, { name: name });

        const currentRoomName = await redis.hGet(`player-${socket.id}`, "currentRoomName");
        if (currentRoomName && currentRoomName !== "") {
            io.to(currentRoomName).emit("playerNameChanged", socket.id, name.trim());
        }
    })

    socket.on("readyToggle", async () => {
        const player = await redis.hGetAll(`player-${socket.id}`) as player;

        const roomName = player.currentRoomName;
        if (roomName === "") {
            socket.emit("error", "You are not in a room");
            return;
        }

        const gameStarted = await redis.hGet(`room-${roomName}`, "gameStarted");
        if (gameStarted === "true") return;

        const playerNewStatus = await redis.hGet(`player-${socket.id}`, "status") === "waiting" ? "ready" : "waiting";

        await redis.hSet(`player-${socket.id}`, { status: playerNewStatus });

        io.to(roomName).emit("playerReady", socket.id, playerNewStatus);

        if (playerNewStatus === "ready")
            await tryStartRound(io, socket, roomName);
    })
}

export default userEvents;
