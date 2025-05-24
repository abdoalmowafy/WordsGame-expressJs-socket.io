import { Server, Socket } from "socket.io";
import userEvents from "./user";
import roomEvents from "./room";
import gameEvents from "./round";

function MapSockets(io: Server, socket: Socket) {
    userEvents(io, socket);
    roomEvents(io, socket);
    gameEvents(io, socket);
}

export default MapSockets;