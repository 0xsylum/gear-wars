# 🎮 Gear Wars - Advanced Battle Arena

A feature-rich Telegram Mini App battle game with real-time multiplayer, betting system, tournaments, and achievements.

![Gear Wars Banner](https://via.placeholder.com/800x200/2c3e50/ffffff?text=Gear+Wars+Battle+Arena)

## 🚀 Features

### 🎯 Core Gameplay
- **Real-time 2D battles** in dynamic arenas
- **Dual control schemes** - Keyboard & Touch optimized
- **Advanced combat system** with gears, shields, and parries
- **Power-up collection** (gears, hearts, shields, speed boosts)
- **Heat meter system** for special attacks

### 🌐 Multiplayer
- **Real-time PvP battles** via WebSocket
- **Room-based matchmaking** with shareable codes
- **Synchronized game state** across players
- **Chat system** during matches
- **Reconnection handling** with heartbeat

### 💰 Economy & Betting
- **Coin system** with daily bonuses
- **Bet creation & matching** between players
- **Smart payout system** (1.9x returns)
- **Betting lobby** with live orders
- **Balance tracking** and statistics

### 🏆 Tournaments
- **Bracket-based tournaments** (8 players)
- **Entry fees** and prize pools
- **Multiple formats** (single elimination)
- **Automatic match scheduling**
- **Real-time tournament updates**

### 🎖️ Progression
- **Achievement system** with 15+ unlockables
- **Player statistics** tracking
- **Leaderboard** with rankings
- **Color customization**
- **Win streaks** and special rewards
 # 🎮 Gear Wars - P3D Network Integration

## 🌟 P3D Features Integrated

### 💰 **P3D Rewards System**
- **Win Battles**: Earn P3D for victories
- **Place Bets**: Get P3D for betting activity  
- **Tournaments**: Major P3D prizes for tournament wins
- **Referrals**: P3D bonuses for inviting friends
- **Daily Bonuses**: Consistent P3D earnings

### 🏆 **P3D Leaderboard**
- Real-time P3D balance rankings
- Monthly P3D prize pools for top players
- Special P3D achievements and badges

### 📈 **P3D Staking**
- **15% APR** staking rewards
- Flexible staking amounts
- Compound interest system

## 🚀 Getting Started for P3D Community

### **For Players:**
1. **Start Playing** - Earn P3D from every game
2. **Check Balance** - Use `/p3d` command
3. **Stake Tokens** - Use `/p3d_stake` command
4. **Climb Leaderboard** - Use `/p3d_leaderboard`

### **For Developers:**
The codebase is now P3D-ready with:
- Full Web3 integration structure
- Smart contract interfaces
- Reward distribution system
- Staking mechanics

## 🔧 Technical Integration

### **Smart Contract Ready**
```javascript
// P3D contract integration
const p3dManager = new P3DGameManager();
await p3dManager.initialize();

// Award tokens for game actions
await p3dManager.handleGameResult(userId, gameData);
