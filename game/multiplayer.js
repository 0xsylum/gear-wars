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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('✅ Already connected to server');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//gear-wars.onrender.com`;
        
        console.log(`🔗 Connecting to: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ Connected to multiplayer server');
            this.gameState = 'connected';
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
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
            console.log('🔌 Disconnected from server:', event.code, event.reason);
            this.gameState = 'disconnected';
            this.stopHeartbeat();
            
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnect();
            } else {
                this.showNotification('Disconnected from server', 'error');
                this.cleanup();
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
        this.showNotification(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');
        
        setTimeout(() => {
            if (this.gameState === 'disconnected') {
                this.connect();
            }
        }, delay);
    }
    
    startHeartbeat() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });
                
                // Check if we haven't received a pong in a while
                if (Date.now() - this.lastPong > 30000) {
                    console.warn('⚠️ No pong received, reconnecting...');
                    this.ws.close();
                }
            }
        }, 15000); // Send ping every 15 seconds
    }
    
    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    handleMessage(message) {
        console.log('📨 Received:', message.type, message);
        
        switch (message.type) {
            case 'connected':
                this.playerId = message.playerId;
                this.showNotification('Connected to multiplayer', 'success');
                break;
                
            case 'pong':
                this.lastPong = Date.now();
                break;
                
            case 'room_created':
                this.handleRoomCreated(message);
                break;
                
            case 'player_joined':
                this.handlePlayerJoined(message);
                break;
                
            case 'game_starting':
                this.handleGameStarting(message);
                break;
                
            case 'game_start':
                this.handleGameStart(message);
                break;
                
            case 'game_update':
                this.handleGameUpdate(message);
                break;
                
            case 'player_input':
                this.handlePlayerInput(message);
                break;
                
            case 'player_left':
                this.handlePlayerLeft(message);
                break;
                
            case 'new_host':
                this.handleNewHost(message);
                break;
                
            case 'game_ended':
                this.handleGameEnded(message);
                break;
                
            case 'chat_message':
                this.handleChatMessage(message);
                break;
                
            case 'error':
                this.handleError(message);
                break;
                
            default:
                console.warn('⚠️ Unknown message type:', message.type);
        }
    }
    
    handleRoomCreated(message) {
        this.roomId = message.roomId;
        this.isHost = true;
        this.showWaitingScreen();
        this.showNotification('Room created! Share the code with your friend.', 'success');
    }
    
    handlePlayerJoined(message) {
        this.showNotification('Player joined the room!', 'success');
        this.updateWaitingScreen(message.room);
    }
    
    handleGameStarting(message) {
        this.showNotification('Game starting in 3 seconds...', 'info');
        this.updateWaitingScreen({ gameState: 'starting' });
    }
    
    handleGameStart(message) {
        this.opponentId = message.players.find(id => id !== this.playerId);
        this.hideWaitingScreen();
        this.startMultiplayerGame(message.players);
        this.showNotification('Game started!', 'success');
    }
    
    handleGameUpdate(message) {
        if (message.playerId === this.opponentId && window.game) {
            window.game.updateOpponentState(message.state);
        }
    }
    
    handlePlayerInput(message) {
        if (message.playerId === this.opponentId && window.game) {
            window.game.handleOpponentInput(message.input);
        }
    }
    
    handlePlayerLeft(message) {
        this.showNotification('Opponent left the game', 'warning');
        if (window.game) {
            window.game.endGame('opponent_left');
        }
        this.cleanup();
    }
    
    handleNewHost(message) {
        if (message.hostId === this.playerId) {
            this.isHost = true;
            this.showNotification('You are now the room host', 'info');
        }
    }
    
    handleGameEnded(message) {
        this.showNotification('Game ended: ' + (message.reason || 'Unknown reason'), 'info');
        this.cleanup();
    }
    
    handleChatMessage(message) {
        this.showChatMessage(message.playerId, message.message);
    }
    
    handleError(message) {
        this.showNotification('Error: ' + message.message, 'error');
        this.cleanup();
    }
    
    createRoom() {
        if (!this.isConnected()) {
            this.showNotification('Not connected to server', 'error');
            return;
        }
        this.send({ type: 'create_room' });
    }
    
    joinRoom(roomId) {
        if (!this.isConnected()) {
            this.showNotification('Not connected to server', 'error');
            return;
        }
        
        roomId = roomId.toUpperCase().trim();
        if (!roomId || roomId.length !== 6) {
            this.showNotification('Invalid room code', 'error');
            return;
        }
        
        this.send({ type: 'join_room', roomId: roomId });
    }
    
    leaveRoom() {
        if (this.roomId) {
            this.send({ type: 'leave_room' });
        }
        this.cleanup();
    }
    
    sendGameState(state) {
        if (this.isConnected() && this.roomId) {
            this.send({ 
                type: 'game_state', 
                state: state,
                timestamp: Date.now()
            });
        }
    }
    
    sendInput(input) {
        if (this.isConnected() && this.roomId) {
            this.send({ 
                type: 'player_input', 
                input: input,
                timestamp: Date.now()
            });
        }
    }
    
    sendChatMessage(message) {
        if (this.isConnected() && this.roomId && message.trim()) {
            this.send({ 
                type: 'chat_message', 
                message: message.trim(),
                timestamp: Date.now()
            });
        }
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ Failed to send message:', error);
            }
        }
    }
    
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    showWaitingScreen() {
        this.hideWaitingScreen();
        
        const waitingHTML = `
            <div id="waitingScreen" class="screen">
                <div class="waiting-content">
                    <h1>🎮 Waiting for Player</h1>
                    <div class="room-code">
                        <p>Room Code:</p>
                        <div class="code-display">${this.roomId}</div>
                        <p class="share-hint">Share this code with your friend!</p>
                    </div>
                    <div class="room-info">
                        <div class="info-item">
                            <span class="label">Players:</span>
                            <span class="value">1/2</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Status:</span>
                            <span class="value">Waiting...</span>
                        </div>
                    </div>
                    <div class="loader"></div>
                    <div class="waiting-actions">
                        <button onclick="multiplayer.leaveRoom()" class="btn btn-secondary">Leave Room</button>
                        <button onclick="multiplayer.copyRoomCode()" class="btn btn-primary">Copy Code</button>
                    </div>
                    <div class="chat-box">
                        <div class="chat-messages" id="chatMessages"></div>
                        <div class="chat-input">
                            <input type="text" id="chatInput" placeholder="Type a message..." maxlength="100">
                            <button onclick="multiplayer.sendChat()">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', waitingHTML);
        
        // Setup chat input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChat();
                }
            });
        }
    }
    
    updateWaitingScreen(roomInfo) {
        const waitingScreen = document.getElementById('waitingScreen');
        if (!waitingScreen) return;
        
        if (roomInfo.players !== undefined) {
            const playersElement = waitingScreen.querySelector('.info-item .value');
            if (playersElement) {
                playersElement.textContent = `${roomInfo.players}/${roomInfo.maxPlayers || 2}`;
            }
        }
        
        if (roomInfo.gameState === 'starting') {
            const statusElement = waitingScreen.querySelector('.info-item .value');
            if (statusElement) {
                statusElement.textContent = 'Starting...';
            }
            const loader = waitingScreen.querySelector('.loader');
            if (loader) {
                loader.innerHTML = '<div class="countdown">3</div>';
            }
        }
    }
    
    hideWaitingScreen() {
        const waitingScreen = document.getElementById('waitingScreen');
        if (waitingScreen) {
            waitingScreen.remove();
        }
    }
    
    copyRoomCode() {
        if (this.roomId) {
            navigator.clipboard.writeText(this.roomId).then(() => {
                this.showNotification('Room code copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = this.roomId;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('Room code copied!', 'success');
            });
        }
    }
    
    sendChat() {
        const chatInput = document.getElementById('chatInput');
        if (chatInput && chatInput.value.trim()) {
            this.sendChatMessage(chatInput.value);
            chatInput.value = '';
        }
    }
    
    showChatMessage(playerId, message) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const isOwnMessage = playerId === this.playerId;
            const messageElement = document.createElement('div');
            messageElement.className = `chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`;
            messageElement.innerHTML = `
                <div class="message-content">${this.escapeHtml(message)}</div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    startMultiplayerGame(players) {
        if (window.game) {
            window.game.startMultiplayer(players, this.playerId);
        }
    }
    
    showNotification(message, type = 'info') {
        console.log(`📢 ${type}: ${message}`);
        
        // Remove existing notification
        const existingNotification = document.getElementById('multiplayerNotification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'multiplayerNotification';
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    cleanup() {
        this.stopHeartbeat();
        this.hideWaitingScreen();
        this.roomId = null;
        this.opponentId = null;
        this.isHost = false;
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    // Public API
    getRoomId() { return this.roomId; }
    getPlayerId() { return this.playerId; }
    getOpponentId() { return this.opponentId; }
    getIsHost() { return this.isHost; }
    getGameState() { return this.gameState; }
}

// Initialize multiplayer manager
const multiplayer = new MultiplayerManager();

// Add CSS for multiplayer components
const multiplayerStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2c3e50;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
        animation: slideInRight 0.3s ease;
    }
    
    .notification-success { border-left: 4px solid #2ecc71; }
    .notification-error { border-left: 4px solid #e74c3c; }
    .notification-warning { border-left: 4px solid #f39c12; }
    .notification-info { border-left: 4px solid #3498db; }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: between;
    }
    
    .notification-message {
        flex: 1;
        margin-right: 10px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
    }
    
    .waiting-content {
        text-align: center;
        max-width: 400px;
        padding: 20px;
    }
    
    .room-code {
        margin: 20px 0;
    }
    
    .code-display {
        font-size: 2.5em;
        font-weight: bold;
        letter-spacing: 4px;
        background: rgba(52, 152, 219, 0.2);
        padding: 15px;
        border-radius: 10px;
        margin: 10px 0;
        border: 2px solid #3498db;
    }
    
    .share-hint {
        color: #bdc3c7;
        font-size: 0.9em;
        margin-top: 5px;
    }
    
    .room-info {
        background: rgba(255,255,255,0.1);
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
    }
    
    .info-item {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
    }
    
    .label {
        color: #bdc3c7;
    }
    
    .value {
        font-weight: bold;
        color: #ecf0f1;
    }
    
    .waiting-actions {
        margin: 20px 0;
        display: flex;
        gap: 10px;
        justify-content: center;
    }
    
    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    
    .btn-primary {
        background: #3498db;
        color: white;
    }
    
    .btn-secondary {
        background: #7f8c8d;
        color: white;
    }
    
    .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    
    .chat-box {
        margin-top: 20px;
        background: rgba(0,0,0,0.3);
        border-radius: 8px;
        padding: 15px;
    }
    
    .chat-messages {
        height: 150px;
        overflow-y: auto;
        margin-bottom: 10px;
        border: 1px solid #34495e;
        border-radius: 5px;
        padding: 10px;
        background: rgba(0,0,0,0.2);
    }
    
    .chat-message {
        margin: 8px 0;
        padding: 8px;
        border-radius: 5px;
        max-width: 80%;
    }
    
    .own-message {
        background: #3498db;
        margin-left: auto;
        text-align: right;
    }
    
    .other-message {
        background: #2c3e50;
        margin-right: auto;
    }
    
    .message-content {
        word-wrap: break-word;
    }
    
    .message-time {
        font-size: 0.7em;
        opacity: 0.7;
        margin-top: 2px;
    }
    
    .chat-input {
        display: flex;
        gap: 8px;
    }
    
    .chat-input input {
        flex: 1;
        padding: 8px;
        border: 1px solid #34495e;
        border-radius: 4px;
        background: #2c3e50;
        color: white;
    }
    
    .countdown {
        font-size: 1.5em;
        font-weight: bold;
        color: #3498db;
        animation: pulse 1s infinite;
    }
    
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = multiplayerStyles;
document.head.appendChild(styleSheet);

// Auto-connect when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        multiplayer.connect();
    }, 1000);
});

// Export for global access
window.MultiplayerManager = MultiplayerManager;
window.multiplayer = multiplayer;
