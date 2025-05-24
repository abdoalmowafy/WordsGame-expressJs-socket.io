type player = {
    id: string
    name: string
    currentRoomName: string
    status: "waiting" | "playing" | "ready"
}

export default player;