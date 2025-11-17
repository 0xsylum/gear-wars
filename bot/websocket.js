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
            
            // Setup heartbeat
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
                    this.sendToPlayer(playerId, { 
                        type: 'error', 
                        message: 'Invalid message format' 
                    });
                }
            });

            ws.on('close', () => {
                console.log(`🔌 Player disconnected: ${playerId}`);
                this.handleDisconnect(playerId);
            });

            ws.on('error', (error) => {
                console.error(`💥 WebSocket error for ${playerId}:`, error);
                this.handleDisconnect(playerId);
            });

            // Send connection confirmation
            this.sendToPlayer(playerId, { 
                type: 'connected', 
                playerId,
                timestamp: Date.now()
            });
        });

        // Heartbeat interval (30 seconds)
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log('💔 Terminating dead connection');
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    handleMessage(playerId, message) {
        const player = this.players.get(playerId);
        if (!player) return;

        console.log(`📨 Message from ${playerId}:`, message.type);

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
            default:
                console.warn(`⚠️ Unknown message type: ${message.type}`);
        }
    }

    createRoom(playerId) {
        const roomId = uuidv4().substring(0, 6).toUpperCase(); // Shorter, readable ID
        const room = {
            id: roomId,
            players: [playerId],
            host: playerId,
            gameState: 'waiting',
            createdAt: Date.now(),
            maxPlayers: 2
        };
        
        this.rooms.set(roomId, room);
        
        const player = this.players.get(playerId);
        player.roomId = roomId;
        
        console.log(`🎮 Room created: ${roomId} by ${playerId}`);
        
        this.sendToPlayer(playerId, {
            type: 'room_created',
            roomId: roomId,
            isHost: true
        });

        return roomId;
    }

    joinRoom(playerId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            this.sendToPlayer(playerId, {
                type: 'error',
                message: 'Room not found'
            });
            return false;
        }
        
        if (room.players.length >= room.maxPlayers) {
            this.sendToPlayer(playerId, {
                type: 'error',
                message: 'Room is full'
            });
            return false;
        }
        
        if (room.gameState !== 'waiting') {
            this.sendToPlayer(playerId, {
                type: 'error',
                message: 'Game already in progress'
            });
            return false;
        }
        
        room.players.push(playerId);
        const player = this.players.get(playerId);
        player.roomId = roomId;
        
        console.log(`🎯 Player ${playerId} joined room ${roomId}`);
        
        // Notify all players in room
        this.broadcastToRoom(roomId, {
            type: 'player_joined',
            playerId: playerId,
            room: this.getRoomInfo(roomId),
            timestamp: Date.now()
        });
        
        // If room is now full, start game
        if (room.players.length === room.maxPlayers) {
            room.gameState = 'starting';
            this.broadcastToRoom(roomId, {
                type: 'game_starting',
                players: room.players,
                roomId: roomId,
                timestamp: Date.now()
            });
            
            // Give clients 3 seconds to prepare
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
        
        return true;
    }

    leaveRoom(playerId) {
        const player = this.players.get(playerId);
        if (!player || !player.roomId) return;
        
        const roomId = player.roomId;
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        room.players = room.players.filter(id => id !== playerId);
        player.roomId = null;
        
        console.log(`🚪 Player ${playerId} left room ${roomId}`);
        
        if (room.players.length === 0) {
            // Room is empty, delete it
            this.rooms.delete(roomId);
            console.log(`🗑️ Room ${roomId} deleted (empty)`);
        } else {
            // Notify remaining players
            this.broadcastToRoom(roomId, {
                type: 'player_left',
                playerId: playerId,
                room: this.getRoomInfo(roomId),
                timestamp: Date.now()
            });
            
            // Update host if host left
            if (room.host === playerId && room.players.length > 0) {
                room.host = room.players[0];
                this.broadcastToRoom(roomId, {
                    type: 'new_host',
                    hostId: room.host,
                    timestamp: Date.now()
                });
            }
            
            // If game was active, end it
            if (room.gameState === 'active') {
                room.gameState = 'ended';
                this.broadcastToRoom(roomId, {
                    type: 'game_ended',
                    reason: 'player_left',
                    timestamp: Date.now()
                });
            }
        }
    }

    handleDisconnect(playerId) {
        this.leaveRoom(playerId);
        this.players.delete(playerId);
    }

    broadcastToRoom(roomId, message, excludePlayerId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        room.players.forEach(playerId => {
            if (playerId !== excludePlayerId) {
                this.sendToPlayer(playerId, message);
            }
        });
    }

    sendToPlayer(playerId, message) {
        const player = this.players.get(playerId);
        if (player && player.ws.readyState === 1) { // OPEN
            try {
                player.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error(`❌ Failed to send to ${playerId}:`, error);
            }
        }
    }

    getRoomInfo(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        return {
            id: room.id,
            players: room.players.length,
            maxPlayers: room.maxPlayers,
            host: room.host,
            gameState: room.gameState,
            createdAt: room.createdAt
        };
    }

    getStats() {
        return {
            totalPlayers: this.players.size,
            totalRooms: this.rooms.size,
            activeRooms: Array.from(this.rooms.values()).filter(room => 
                room.gameState === 'active'
            ).length
        };
    }
}

module.exports = WebSocketManager;
