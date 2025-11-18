// Multiplayer manager for real-time PvP
class MultiplayerManager {
    constructor() {
        this.ws = null;
        this.roomId = null;
        this.playerId = null;
        this.opponentId = null;
        this.isHost = false;
        this.gameState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        this.lastPong = Date.now();
    }
    
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        
        // Use the bot's Render URL for WebSocket
        const wsUrl = `wss://your-bot.onrender.com`;
        console.log(`🔗 Connecting to ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ Connected to multiplayer server');
            this.gameState = 'connected';
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.showNotification('Connected to server', 'success');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('❌ Message parse error:', error);
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('🔌 Disconnected:', event.code);
            this.gameState = 'disconnected';
            this.stopHeartbeat();
            
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnect();
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('💥 WebSocket error:', error);
            this.showNotification('Connection error', 'error');
        };
    }
    
    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`🔄 Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (this.gameState === 'disconnected') this.connect();
        }, delay);
    }
    
    startHeartbeat() {
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });
                if (Date.now() - this.lastPong > 30000) {
                    console.warn('⚠️ No pong, reconnecting...');
                    this.ws.close();
                }
            }
        }, 15000);
    }
    
    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                this.playerId = message.playerId;
                break;
            case 'pong':
                this.lastPong = Date.now();
                break;
            case 'room_created':
                this.roomId = message.roomId;
                this.isHost = true;
                alert(`Room created! Code: ${this.roomId}`);
                break;
            case 'game_start':
                this.opponentId = message.players.find(id => id !== this.playerId);
                this.startMultiplayerGame(message.players);
                break;
            case 'game_update':
                if (message.playerId === this.opponentId) {
                    // Update opponent in game
                    window.game.updateOpponent(message.state);
                }
                break;
            case 'error':
                alert(`Error: ${message.message}`);
                break;
        }
    }
    
    createRoom() {
        this.send({ type: 'create_room' });
    }
    
    joinRoom(roomId) {
        roomId = roomId.toUpperCase().trim();
        if (!roomId || roomId.length !== 6) {
            alert('Invalid room code');
            return;
        }
        this.send({ type: 'join_room', roomId });
    }
    
    sendGameState(state) {
        this.send({ type: 'game_state', state });
    }
    
    send(message) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    showNotification(message, type = 'info') {
        console.log(`📢 ${type}: ${message}`);
    }
}

// Initialize multiplayer on load
window.multiplayer = new MultiplayerManager();
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => multiplayer.connect(), 1000);
});
