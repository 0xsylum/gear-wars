const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class WebSocketManager {
    constructor() {
        this.wss = new WebSocket.Server({ noServer: true });
        this.rooms = new Map();
        this.players = new Map();
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, request) => {
            const playerId = uuidv4();
            console.log(`🔗 Player connected: ${playerId}`);
            
            this.players.set(playerId, { 
                ws, 
                roomId: null,
                lastPing: Date.now(),
                isAlive: true
            });
            
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
                const player = this.players.get(playerId);
                if (player) player.lastPing = Date.now();
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(playerId, message);
                } catch (error) {
                    console.error('❌ Message parse error:', error);
                    this.sendToPlayer(playerId, { type: 'error', message: 'Invalid format' });
                }
            });

            ws.on('close', () => this.handleDisconnect(playerId));
            ws.on('error', (error) => {
                console.error(`💥 WebSocket error for ${playerId}:`, error);
                this.handleDisconnect(playerId);
            });

            this.sendToPlayer(playerId, { type: 'connected', playerId, timestamp: Date.now() });
        });

        // Heartbeat every 30 seconds
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    handleMessage(playerId, message) {
        const player = this.players.get(playerId);
        if (!player) return;

        switch (message.type) {
            case 'ping':
                this.sendToPlayer(playerId, { type: 'pong', timestamp: Date.now() });
                break;
            case 'create_room':
                this.createRoom(playerId);
                break;
            case 'join_room':
                this.joinRoom(playerId, message.roomId);
                break;
            case 'leave_room':
                this.leaveRoom(playerId);
                break;
            case 'game_state':
                this.broadcastToRoom(player.roomId, {
                    type: 'game_update',
                    playerId: playerId,
                    state: message.state,
                    timestamp: Date.now()
                }, playerId);
                break;
            case 'player_input':
                this.broadcastToRoom(player.roomId, {
                    type: 'player_input',
                    playerId: playerId,
                    input: message.input,
                    timestamp: Date.now()
                }, playerId);
                break;
            case 'chat_message':
                this.broadcastToRoom(player.roomId, {
                    type: 'chat_message',
                    playerId: playerId,
                    message: message.message,
                    timestamp: Date.now()
                });
                break;
        }
    }

    createRoom(playerId) {
        const roomId = uuidv4().substring(0, 6).toUpperCase();
        const room = {
            id: roomId,
            players: [playerId],
            host: playerId,
            gameState: 'waiting',
            createdAt: Date.now(),
            maxPlayers: 2
        };
        
        this.rooms.set(roomId, room);
        this.players.get(playerId).roomId = roomId;
        
        this.sendToPlayer(playerId, {
            type: 'room_created',
            roomId: roomId,
            isHost: true
        });
    }

    joinRoom(playerId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return this.sendToPlayer(playerId, { type: 'error', message: 'Room not found' });
        }
        
        if (room.players.length >= room.maxPlayers) {
            return this.sendToPlayer(playerId, { type: 'error', message: 'Room is full' });
        }
        
        room.players.push(playerId);
        this.players.get(playerId).roomId = roomId;
        
        this.broadcastToRoom(roomId, {
            type: 'player_joined',
            playerId: playerId,
            room: this.getRoomInfo(roomId),
            timestamp: Date.now()
        });
        
        if (room.players.length === room.maxPlayers) {
            room.gameState = 'starting';
            this.broadcastToRoom(roomId, {
                type: 'game_starting',
                players: room.players,
                roomId: roomId,
                timestamp: Date.now()
            });
            
            setTimeout(() => {
                room.gameState = 'active';
                this.broadcastToRoom(roomId, {
                    type: 'game_start',
                    players: room.players,
                    roomId: roomId,
                    timestamp: Date.now()
                });
            }, 3000);
        }
    }

    leaveRoom(playerId) {
        const player = this.players.get(playerId);
        if (!player || !player.roomId) return;
        
        const roomId = player.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        room.players = room.players.filter(id => id !== playerId);
        player.roomId = null;
        
        this.broadcastToRoom(roomId, {
            type: 'player_left',
            playerId: playerId,
            room: this.getRoomInfo(roomId),
            timestamp: Date.now()
        });
        
        if (room.players.length === 0) {
            this.rooms.delete(roomId);
        } else if (room.host === playerId) {
            room.host = room.players[0];
            this.broadcastToRoom(roomId, { type: 'new_host', hostId: room.host });
        }
    }

    handleDisconnect(playerId) {
        this.leaveRoom(playerId);
        this.players.delete(playerId);
    }

    broadcastToRoom(roomId, message, excludePlayerId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        room.players.forEach(id => {
            if (id !== excludePlayerId) this.sendToPlayer(id, message);
        });
    }

    sendToPlayer(playerId, message) {
        const player = this.players.get(playerId);
        if (player && player.ws.readyState === 1) {
            try {
                player.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error(`❌ Failed to send to ${playerId}:`, error);
            }
        }
    }

    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        return room ? {
            id: room.id,
            players: room.players.length,
            maxPlayers: room.maxPlayers,
            host: room.host,
            gameState: room.gameState
        } : null;
    }

    getStats() {
        return {
            totalPlayers: this.players.size,
            totalRooms: this.rooms.size,
            activeRooms: Array.from(this.rooms.values()).filter(r => r.gameState === 'active').length
        };
    }
}

module.exports = WebSocketManager;
