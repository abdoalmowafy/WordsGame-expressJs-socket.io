import { Server, Socket } from "socket.io";
import redis from "../redis";
import wordIsValid from "../validateWordService";
import round from "../models/round";

let currentTimeout: NodeJS.Timeout;

async function submitWord(io: Server, socket: Socket, roomName: string, newWord: string) {
    newWord = newWord.trim().toLowerCase().replace(/[^a-z]/g, '');

    const isValid = await wordIsValid(newWord);
    console.log(`API says: Word ${newWord} is ${isValid}`);
    if (!isValid) {
        io.to(roomName).emit("wrongWord", newWord);
        return;
    }

    const currentWord = await redis.hGet(`round-${roomName}`, "word");
    if (currentWord && currentWord.length > 0) {
        const lastChar = currentWord[currentWord.length - 1];
        console.log(`New word should start with ${lastChar}`);

        const isUsedBefore = await redis.sIsMember(`usedWords-${roomName}`, newWord);
        if (lastChar !== newWord[0] || isUsedBefore) {
            socket.emit("wrongWord", newWord);
            return;
        }
    }
    await redis.sAdd(`usedWords-${roomName}`, newWord);
    await redis.hSet(`round-${roomName}`, { word: newWord });
    io.to(roomName).emit("newWord", newWord);

    await findSetNextPlayerRandomly(io, socket, roomName);
}

async function findSetNextPlayerRandomly(io: Server, socket: Socket, roomName: string) {
    await redis.sRem(`inGameSmallRound-${roomName}`, socket.id);
    if (currentTimeout) clearTimeout(currentTimeout);

    if (await redis.sCard(`inGameSmallRound-${roomName}`) === 0) {
        await redis.sDiffStore(`inGameSmallRound-${roomName}`, [`inGamePlayers-${roomName}`]);
    }
    const nextPlayerId = await redis.sRandMember(`inGameSmallRound-${roomName}`) as string;
    await redis.hSet(`round-${roomName}`, { playerTurnId: nextPlayerId });

    io.to(roomName).emit("nextPlayer", nextPlayerId, await redis.hGet(`player-${nextPlayerId}`, "name"));

    currentTimeout = setTimeout(() => eliminatePlayer(io, socket, nextPlayerId, roomName), 15000);
}

export async function tryStartRound(io: Server, socket: Socket, roomName: string) {
    const players = await redis.sMembers(`roomPlayers-${roomName}`);
    if (players.length < 2) {
        socket.emit("error", "you need at least 2 ready players to start the game");
        return;
    }

    const AllReady = await Promise.all(players.map(async (playerId) =>
        await redis.hGet(`player-${playerId}`, "status") === "ready"
    )).then(results => results.every(result => result));
    if (!AllReady) return;

    await redis.hSet(`room-${roomName}`, { gameStarted: "true" });
    players.forEach(async (playerId) => {
        await redis.hSet(`player-${playerId}`, { status: "playing" });
        await redis.sAdd(`inGamePlayers-${roomName}`, playerId);
    });

    const round: round = {
        word: "",
        playerTurnId: "",
    }
    await redis.hSet(`round-${roomName}`, round);

    io.to(roomName).emit("startRound");

    await findSetNextPlayerRandomly(io, socket, roomName);
}

export async function eliminatePlayer(io: Server, socket: Socket, playerId: string, roomName: string) {
    if (currentTimeout) clearTimeout(currentTimeout);

    await redis.hSet(`player-${playerId}`, { status: "eliminated" });
    io.to(roomName).emit("playerStatusChanged", socket.id, "eliminated");
    await redis.sRem(`inGamePlayers-${roomName}`, playerId);
    await redis.sRem(`inGameSmallRound-${roomName}`, playerId);

    await findSetNextPlayerRandomly(io, socket, roomName);

    if (await redis.sCard(`inGamePlayers-${roomName}`) === 1) {
        endRound(io, socket, roomName);
    }
}

async function endRound(io: Server, socket: Socket, roomName: string) {
    io.to(roomName).emit("endRound", (await redis.sMembers(`inGamePlayers-${roomName}`))[0]);

    await redis.del(`inGamePlayers-${roomName}`);
    await redis.del(`inGameSmallRound-${roomName}`);
    await redis.del(`usedWords-${roomName}`);
    await redis.del(`round-${roomName}`);
    await redis.hSet(`room-${roomName}`, { gameStarted: "false" });

    if (currentTimeout) clearTimeout(currentTimeout);

    const roomPlayers = await redis.sMembers(`roomPlayers-${roomName}`);
    roomPlayers.forEach(async (playerId) => {
        await redis.hSet(`player-${playerId}`, { status: "waiting" });
    });
}

async function RoundEvents(io: Server, socket: Socket) {
    socket.on("submitWord", async (word: string) => {
        const roomName = await redis.hGet(`player-${socket.id}`, "currentRoomName");
        if (!roomName || roomName === "") return;

        const isPlayerTurn = await redis.hGet(`round-${roomName}`, "playerTurnId") === socket.id;
        if (isPlayerTurn === false) return;

        await submitWord(io, socket, roomName, word);
    });
}

export default RoundEvents; 
