class MultiplayerManager {
    constructor() {
        this.ws = null;
        this.roomId = null;
        this.playerId = null;
        this.opponentId = null;
        this.isHost = false;
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to multiplayer server');
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from multiplayer server');
        };
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                this.playerId = message.playerId;
                break;
            case 'room_created':
                this.roomId = message.roomId;
                this.isHost = true;
                this.showWaitingScreen();
                break;
            case 'game_start':
                this.opponentId = message.players.find(id => id !== this.playerId);
                this.startMultiplayerGame();
                break;
            case 'game_update':
                if (message.playerId === this.opponentId) {
                    this.updateOpponentState(message.state);
                }
                break;
            case 'player_input':
                if (message.playerId === this.opponentId) {
                    this.handleOpponentInput(message.input);
                }
                break;
            case 'player_left':
                this.handleOpponentLeft();
                break;
        }
    }
    
    createRoom() {
        this.send({ type: 'create_room' });
    }
    
    joinRoom(roomId) {
        this.send({ type: 'join_room', roomId });
    }
    
    sendGameState(state) {
        this.send({ type: 'game_state', state });
    }
    
    sendInput(input) {
        this.send({ type: 'player_input', input });
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    showWaitingScreen() {
        // Show waiting screen with room code
        const waitingHTML = `
            <div class="screen">
                <h1>🎮 Waiting for Player</h1>
                <p>Room Code: <strong>${this.roomId}</strong></p>
                <p>Share this code with your friend!</p>
                <div class="loader"></div>
                <button onclick="multiplayer.cancelWaiting()">Cancel</button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', waitingHTML);
    }
    
    startMultiplayerGame() {
        // Remove waiting screen and start game
        document.querySelector('.screen')?.remove();
        // Initialize game with multiplayer mode
        if (window.game) {
            window.game.startMultiplayer();
        }
    }
    
    cancelWaiting() {
        // Leave room and go back to menu
        document.querySelector('.screen')?.remove();
        this.roomId = null;
        this.isHost = false;
    }
    
    handleOpponentLeft() {
        if (window.game) {
            window.game.endGame('opponent_left');
        }
    }
}

const multiplayer = new MultiplayerManager();
