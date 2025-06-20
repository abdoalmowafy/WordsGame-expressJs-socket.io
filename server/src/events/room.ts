import { Server, Socket } from "socket.io";
import redis from "../redis";
import bcrypt from "bcrypt";
import room from "../models/room";
import { eliminatePlayer } from "./round";

async function createRoom(io: Server, socket: Socket, roomName: string, roomPassword: string | null) {
    await redis.sAdd("rooms", roomName);
    const room: room = {
        roomName: roomName,
        passwordHash: roomPassword ? await bcrypt.hash(roomPassword, 10) : "",
        roomLeaderId: socket.id,
        gameStarted: "false"
    };
    await redis.hSet(`room-${roomName}`, room);

    console.log(`Room ${roomName} created`);
}

async function joinRoom(io: Server, socket: Socket, roomName: string) {
    await redis.sAdd(`roomPlayers-${roomName}`, socket.id);

    await redis.hSet(`player-${socket.id}`, {
        currentRoomName: roomName,
        status: "waiting"
    });

    socket.join(roomName);
    const playerName = await redis.hGet(`player-${socket.id}`, "name");
    socket.to(roomName).emit("joinedRoom", socket.id, playerName);

    const roomPlayers = await redis.sMembers(`roomPlayers-${roomName}`);
    roomPlayers.forEach(async (playerId) => {
        socket.emit("joinedRoom", playerId, await redis.hGet(`player-${playerId}`, "name"));

        const playerStatus = await redis.hGet(`player-${playerId}`, "status");

        socket.emit("playerStatusChanged", playerId, playerStatus);
    });
};

export async function leaveRoom(io: Server, socket: Socket) {
    const roomName = await redis.hGet(`player-${socket.id}`, "currentRoomName");
    if (!roomName || roomName === "") return;

    const isPlaying = await redis.sIsMember(`inGamePlayers-${roomName}`, socket.id);
    if (isPlaying) await eliminatePlayer(io, socket, socket.id, roomName);

    io.to(roomName).emit("leftRoom", socket.id);
    socket.leave(roomName);

    await redis.hSet(`player-${socket.id}`, {
        currentRoomName: "",
        status: "waiting"
    });

    const roomPlayers = await redis.sMembers(`roomPlayers-${roomName}`);
    if (roomPlayers.length <= 1) {
        await redis.sRem("rooms", roomName);
        await redis.del(`room-${roomName}`);
        await redis.del(`roomPlayers-${roomName}`);
        await redis.del(`inGamePlayers-${roomName}`);
        await redis.del(`inGameSmallRound-${roomName}`);

        console.log(`Room ${roomName} deleted`);
        return;
    }
    await redis.sRem(`roomPlayers-${roomName}`, socket.id);
    const roomLeaderIdIsCurrentUser = await redis.hGet(`room-${roomName}`, "roomLeaderId") === socket.id;
    if (roomLeaderIdIsCurrentUser) {
        await redis.hSet(`room-${roomName}`, { roomLeaderId: roomPlayers[0] });
    }
}

function RoomEvents(io: Server, socket: Socket) {
    socket.on('createRoom', async (roomName: string, roomPassword: string | null) => {
        roomName = roomName.trim();
        roomPassword = roomPassword?.trim() ?? null;

        const playerIsInRoom = await redis.hGet(`player-${socket.id}`, "currentRoomName") !== "";
        if (playerIsInRoom) {
            socket.emit("error", "You are already in a room");
            return;
        }

        if (roomName.length < 3) {
            socket.emit("error", "Room name must be at least 3 characters long");
            return;
        }

        const roomNameExists = await redis.sIsMember("rooms", roomName);
        if (roomNameExists) {
            socket.emit("error", "Room name already exists");
            return;
        }
        await createRoom(io, socket, roomName, roomPassword);
        await joinRoom(io, socket, roomName);
    });

    socket.on('joinRoom', async (roomName: string, roomPassword: string | null) => {
        roomName = roomName.trim();
        roomPassword = roomPassword?.trim() ?? null;

        const playerIsInRoom = await redis.hGet(`player-${socket.id}`, "currentRoomName") !== "";
        if (playerIsInRoom) {
            socket.emit("error", "You are already in a room");
            return;
        }

        const roomExists = await redis.sIsMember("rooms", roomName);
        if (!roomExists) {
            socket.emit("error", "Room does not exist");
            return;
        }

        const room = await redis.hGetAll(`room-${roomName}`);
        if (roomPassword || room.passwordHash !== "") {
            const passwordMatch = await bcrypt.compare(roomPassword!, room.passwordHash as string);
            if (!passwordMatch) {
                socket.emit("error", "Invalid password");
                return;
            }
        }

        await joinRoom(io, socket, roomName);
    });

    socket.on('leaveRoom', async () => {
        await leaveRoom(io, socket);
    });
}

export default RoomEvents;