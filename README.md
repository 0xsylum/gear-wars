# 🎮 Gear Wars - Telegram Battle Arena

A competitive battle arena game built for Telegram Mini Apps with real-time combat, power-ups, and wagering system.

## 🚀 Features

- **Real-time 2D battles** in an arena environment
- **Dual control schemes** - Keyboard for PC, Touch for mobile
- **Power-up system** - Gears for attack, Hearts for healing
- **Screen shake effects** and particle systems
- **Color customization** via Telegram bot
- **Daily bonus system** for player retention
- **Statistics tracking** - wins, losses, balance
- **Mobile-optimized** UI with responsive design

## 🎯 Gameplay

- **Objective**: Reduce opponent's health to zero using gear power-ups
- **Controls**: 
  - PC: Arrow keys for movement
  - Mobile: Touch buttons or direct tap-to-move
- **Power-ups**:
  - ⚙️ Gear: Enables attack mode for 5 seconds
  - ❤️ Heart: Restores 1 health point (max 5)
- **Win Condition**: Deplete opponent's health or have more health when time expires

## 🛠️ Tech Stack

- **Backend**: Node.js + Telegraf (Telegram Bot API)
- **Frontend**: HTML5 Canvas + CSS3 + JavaScript
- **Data Storage**: JSON file system (easily upgradable to database)
- **Hosting**: Compatible with Render, Heroku, Vercel

## 📦 Installation

### Prerequisites
- Node.js 14+
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gear-wars.git
   cd gear-wars
