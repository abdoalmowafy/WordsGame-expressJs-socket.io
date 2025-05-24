type player = {
    id: string
    name: string
    currentRoomName: string
    status: "waiting" | "playing" | "ready" | "eliminated"
}

export default player;