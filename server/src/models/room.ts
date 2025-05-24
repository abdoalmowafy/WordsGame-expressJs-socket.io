import player from "./player";
import round from "./round";

type room = {
    roomName: string,
    passwordHash: string,
    roomLeaderId: string,
    gameStarted: "false" | "true"
}

export default room