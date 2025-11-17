const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ noServer: true });
const rooms = new Map();
const players = new Map();

wss.on('connection', (ws, request) => {
    const playerId = uuidv4();
    players.set(playerId, { ws, roomId: null });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(playerId, message);
        } catch (error) {
            console.error('Message parse error:', error);
        }
    });
    
    ws.on('close', () => {
        const player = players.get(playerId);
        if (player && player.roomId) {
            leaveRoom(playerId, player.roomId);
        }
        players.delete(playerId);
    });
    
    // Send connection confirmation
    ws.send(JSON.stringify({ type: 'connected', playerId }));
});

function handleMessage(playerId, message) {
    const player = players.get(playerId);
    if (!player) return;
    
    switch (message.type) {
        case 'join_room':
            joinRoom(playerId, message.roomId);
            break;
        case 'create_room':
            createRoom(playerId);
            break;
        case 'game_state':
            broadcastToRoom(player.roomId, {
                type: 'game_update',
                playerId: playerId,
                state: message.state
            }, playerId);
            break;
        case 'player_input':
            broadcastToRoom(player.roomId, {
                type: 'player_input',
                playerId: playerId,
                input: message.input
            }, playerId);
            break;
    }
}

function createRoom(playerId) {
    const roomId = uuidv4().substring(0, 8);
    const room = {
        id: roomId,
        players: [playerId],
        gameState: null
    };
    rooms.set(roomId, room);
    
    const player = players.get(playerId);
    player.roomId = roomId;
    
    player.ws.send(JSON.stringify({
        type: 'room_created',
        roomId: roomId
    }));
    
    console.log(`Room ${roomId} created by ${playerId}`);
    return roomId;
}

function joinRoom(playerId, roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        players.get(playerId).ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    if (room.players.length >= 2) {
        players.get(playerId).ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full'
        }));
        return;
    }
    
    room.players.push(playerId);
    const player = players.get(playerId);
    player.roomId = roomId;
    
    // Notify both players that game can start
    broadcastToRoom(roomId, {
        type: 'game_start',
        players: room.players,
        roomId: roomId
    });
    
    console.log(`Player ${playerId} joined room ${roomId}`);
}

function leaveRoom(playerId, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.players = room.players.filter(id => id !== playerId);
    
    if (room.players.length === 0) {
        rooms.delete(roomId);
    } else {
        // Notify remaining player that opponent left
        broadcastToRoom(roomId, {
            type: 'player_left',
            playerId: playerId
        });
    }
}

function broadcastToRoom(roomId, message, excludePlayerId = null) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.players.forEach(playerId => {
        if (playerId !== excludePlayerId) {
            const player = players.get(playerId);
            if (player && player.ws.readyState === 1) { // OPEN
                player.ws.send(JSON.stringify(message));
            }
        }
    });
}

module.exports = { wss, rooms, players };
