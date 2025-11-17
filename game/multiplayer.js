class MultiplayerManager {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.playerId = null;
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}`);

    this.ws.onopen = () => console.log('WS Connected');
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'connected') this.playerId = msg.playerId;
      if (msg.type === 'game_start') this.startGame();
      if (msg.type === 'game_update' && msg.playerId !== this.playerId) {
        window.opponentState = msg.state;
      }
    };
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    this.ws.send(JSON.stringify({ type: 'join_room', roomId }));
  }

  sendState(state) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'game_state', state }));
    }
  }

  startGame() {
    document.getElementById('startScreen')?.remove();
    window.isMultiplayer = true;
    window.gameId = this.roomId;
    window.startRealGame();
  }
}

const multiplayer = new MultiplayerManager();

// AUTO JOIN IF ?game= IN URL
const params = new URLSearchParams(location.search);
const gameParam = params.get('game');
if (gameParam) {
  multiplayer.connect();
  multiplayer.joinRoom(gameParam);
}
