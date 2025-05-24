import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

let currentRoomName;
let socket;
let timerInterval;

// Global DOM element references
const showChangeNameBtn = document.getElementById('showChangeName');
const changeNameForm = document.getElementById('changeName');
const joinRoomForm = document.getElementById('joinRoom');
const createRoomForm = document.getElementById('createRoom');
const playerList = document.getElementById('players');
const readyBtn = document.getElementById('ready');
const leaveRoomBtn = document.getElementById('leaveRoom');
const roomName = document.getElementById('room-name');
const roundStateDiv = document.getElementById('round-state');
const timer = document.querySelector('#timer');
const turn = document.querySelector('#turn');
const currentWord = document.querySelector('#currentWord');
const message = document.querySelector('#message');
const submitWordForm = document.getElementById('submitWord');


let messageTimeout;
function setMessage(messageInput) {
    if (messageTimeout) clearTimeout(messageTimeout);

    message.innerHTML = messageInput;

    messageTimeout = setTimeout(() => {
        message.innerHTML = '';
    }, 5000);
}

function initializeEventListeners() {
    if (showChangeNameBtn) {
        showChangeNameBtn.addEventListener('click', (e) => {
            if (changeNameForm) {
                changeNameForm.removeAttribute('hidden');
                e.currentTarget.setAttribute('hidden', '');
                const nameInput = changeNameForm.querySelector('input[name="name"]');
                if (nameInput) nameInput.focus();
            }
        });
    }

    if (changeNameForm) {
        changeNameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name');
            const nameInput = e.currentTarget.querySelector('input[name="name"]');
            if (nameInput) nameInput.value = '';
            e.currentTarget.setAttribute('hidden', '');
            if (showChangeNameBtn) showChangeNameBtn.removeAttribute('hidden');

            if (socket && socket.connected && name) {
                console.log('Changing name to:', name);
                socket.emit('changeName', name);
            }
        });
    }

    if (createRoomForm) {
        createRoomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name');
            currentRoomName = name ? name.trim() : '';
            const nameInput = e.currentTarget.querySelector('input[name="name"]');
            if (nameInput) nameInput.value = '';

            if (socket && socket.connected && currentRoomName) {
                console.log('Creating room:', currentRoomName);
                socket.emit('createRoom', currentRoomName);
            }
        });
    }

    if (joinRoomForm) {
        joinRoomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name');
            currentRoomName = name ? name.trim() : '';
            const nameInput = e.currentTarget.querySelector('input[name="name"]');
            if (nameInput) nameInput.value = '';

            if (socket && socket.connected && currentRoomName) {
                console.log('Joining room:', currentRoomName);
                socket.emit('joinRoom', currentRoomName);
            }
        });
    }

    if (submitWordForm) {
        submitWordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const word = formData.get('name');
            const nameInput = e.currentTarget.querySelector('input[name="name"]');
            if (nameInput) nameInput.value = '';

            if (socket && socket.connected && word) {
                console.log('Submitting word:', word);
                socket.emit('submitWord', word);
            }
        });
    }

    if (leaveRoomBtn) {
        leaveRoomBtn.addEventListener('click', (e) => {
            if (socket && socket.connected) {
                socket.emit('leaveRoom');
            }
        });
    }

    if (readyBtn) {
        readyBtn.addEventListener('click', (e) => {
            if (socket && socket.connected) {
                socket.emit('readyToggle');
            }
        });
    }
}

function setupSocketEventHandlers() {
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        setMessage('Disconnected from server');
    });

    socket.on('error', (reason) => {
        console.log('Socket error:', reason);
        setMessage(reason);
    });

    socket.on("joinedRoom", (socketId, playerName) => {
        if (socketId === socket.id) {
            if (joinRoomForm) joinRoomForm.setAttribute('hidden', '');
            if (createRoomForm) createRoomForm.setAttribute('hidden', '');
            if (leaveRoomBtn) leaveRoomBtn.removeAttribute('hidden');
            if (readyBtn) readyBtn.removeAttribute('hidden');
            if (roundStateDiv) roundStateDiv.removeAttribute('hidden');
            if (roomName) roomName.innerHTML = `Room: ${currentRoomName}`;

            setMessage('Waiting for players');
        }

        if (playerList && playerName) {
            const li = document.createElement('li');
            li.innerText = playerName;
            li.id = `player-${socketId}`;
            li.style.backgroundColor = 'red';
            playerList.appendChild(li);
        }

        console.log(`Player ${playerName} joined room`);
    });

    socket.on("leftRoom", (socketId) => {
        if (socketId === socket.id) {
            if (playerList) playerList.innerHTML = "";

            if (joinRoomForm) joinRoomForm.removeAttribute('hidden');
            if (createRoomForm) createRoomForm.removeAttribute('hidden');
            if (leaveRoomBtn) leaveRoomBtn.setAttribute('hidden', '');
            if (readyBtn) readyBtn.setAttribute('hidden', '');
            if (submitWordForm) submitWordForm.setAttribute('hidden', '');
            if (roundStateDiv) roundStateDiv.setAttribute('hidden', '');
            if (roomName) roomName.innerHTML = 'Not in a room';
        } else {
            const li = playerList?.querySelector(`#player-${socketId}`);
            if (li && playerList) {
                playerList.removeChild(li);
            }
        }

        console.log(`Player ${socketId} left room`);
    });

    socket.on("playerNameChanged", (socketId, name) => {
        const li = playerList?.querySelector(`#player-${socketId}`);
        if (li && name) {
            li.innerText = name;
            console.log(`Player ${socketId} changed name to ${name}`);
        }
    });

    socket.on("playerReady", (socketId, status) => {
        const li = playerList?.querySelector(`#player-${socketId}`);
        if (li) {
            li.style.backgroundColor = status === 'ready' ? 'green' : 'red';
            console.log(`Player ${socketId} is ${status}`);
        }
    });

    socket.on("startRound", () => {
        setMessage('New round started');
        if (roundStateDiv) roundStateDiv.removeAttribute('hidden');
    });

    socket.on("endRound", (socketId) => {
        const playerEl = document.querySelector(`#player-${socketId}`);
        const playerName = playerEl ? playerEl.innerText : 'Unknown';

        if (submitWordForm) submitWordForm.setAttribute('hidden', '');
        if (timer) timer.innerHTML = '';
        if (roundStateDiv) roundStateDiv.setAttribute('hidden', '');

        // Clear timer interval
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        setMessage(`Player ${playerName} won the round`);
    });

    socket.on("nextPlayer", (socketId, playerName) => {
        if (turn) turn.innerHTML = `${playerName}'s turn`;
        if (timer) timer.innerHTML = '15';

        // Clear existing timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        // Start new timer
        let timeLeft = 15;
        timerInterval = setInterval(() => {
            timeLeft--;
            if (timer) timer.innerHTML = `${timeLeft.toString()} seconds`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }, 1000);

        if (socketId === socket.id) {
            if (submitWordForm) {
                submitWordForm.removeAttribute('hidden');
                const nameInput = submitWordForm.querySelector('input[name="name"]');
                if (nameInput) nameInput.focus();
            }
        } else {
            if (submitWordForm) submitWordForm.setAttribute('hidden', '');
        }

        console.log(`It's ${playerName}'s turn`);
    });

    socket.on("eliminatedPlayer", (socketId) => {
        const playerLi = playerList.querySelector(`#player-${socketId}`);
        if (playerLi) {
            const playerName = playerLi.innerText;
            playerLi.style.backgroundColor = 'blue';
            setMessage(`${playerName} was eliminated`);
        }
    });

    socket.on("newWord", (word) => {
        if (currentWord && word) {
            currentWord.innerHTML = word;
            console.log(`New word: ${word}`);
        }
    });

    socket.on("wrongWord", (word) => {
        console.log(`Word ${word} is not valid`);
        setMessage(`"${word}" is not a valid word`);
    });
}

const URLs = [
    "http://26.183.101.230:3000",
    "http://192.168.1.13:3000",
    "http://localhost:3000",
];

function tryConnect(URLs, index = 0) {
    if (index >= URLs.length) {
        console.error('Failed to connect to any server');
        return;
    }

    console.log(`Trying to connect to: ${URLs[index]}`);

    socket = io(URLs[index], {
        reconnectionDelay: 50,
        reconnectionAttempts: Infinity,
        timeout: 500,
        transports: ['websocket', 'polling']
    });

    socket.on("connect", () => {
        console.log(`Socket connected to: ${URLs[index]}`);
        setupSocketEventHandlers();
    });

    socket.on("connect_error", (err) => {
        console.warn(`Failed to connect to ${URLs[index]}:`, err.message);
        socket.disconnect();
        setTimeout(() => {
            tryConnect(URLs, index + 1);
        }, 1000);
    });
}

initializeEventListeners();
tryConnect(URLs);