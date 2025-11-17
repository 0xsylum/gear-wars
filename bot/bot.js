const { Telegraf } = require('telegraf');
const fs = require('fs');
const http = require('http');
const { wss } = require('./websocket');

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN || '8278879171:AAHIurrSFNEjuuwh3GRyofKSYja821vVwUc');
let data = { users: {}, orders: [], games: [], bets: [] };

// Load/save data
function loadData() {
  try { 
    data = JSON.parse(fs.readFileSync('data.json')); 
  } catch (e) { 
    console.log('No data file, starting fresh'); 
  }
}

function saveData() { 
  fs.writeFileSync('data.json', JSON.stringify(data)); 
}

loadData();

// ========================================
// BOT COMMANDS & HANDLERS
// ========================================

// Start command
bot.command('start', (ctx) => {
  const userId = ctx.from.id;
  if (!data.users[userId]) {
    data.users[userId] = { 
      balance: 1000, 
      wins: 0, 
      losses: 0, 
      color: '#3498db',
      lastDailyBonus: null 
    };
    saveData();
  }
  
  const user = data.users[userId];
  ctx.reply(
    `🎮 Gear Wars - Battle Arena\n\n` +
    `Balance: ${user.balance} coins\n` +
    `Wins: ${user.wins} | Losses: ${user.losses}\n\n` +
    `Choose an action:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚔️ Quick Battle (VS AI)', web_app: { url: 'https://gear-wars.vercel.app/' } }],
          [{ text: '💰 Create Bet', callback_data: 'create_bet' }],
          [{ text: '📊 Order Book', callback_data: 'order_book' }],
          [{ text: '🎨 Change Color', callback_data: 'change_color' }],
          [{ text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }]
        ]
      }
    }
  );
});

// Color selection
bot.action('change_color', (ctx) => {
  const colors = [
    { text: '🔴 Red', color: '#e74c3c' },
    { text: '🔵 Blue', color: '#3498db' },
    { text: '🟢 Green', color: '#2ecc71' },
    { text: '🟡 Yellow', color: '#f1c40f' },
    { text: '🟣 Purple', color: '#9b59b6' },
    { text: '🟠 Orange', color: '#e67e22' }
  ];
  
  ctx.reply('Choose your battle color:', {
    reply_markup: {
      inline_keyboard: colors.map(c => [
        { text: c.text, callback_data: `setcolor_${c.color}` }
      ])
    }
  });
});

bot.action(/setcolor_(.+)/, (ctx) => {
  const color = ctx.match[1];
  const userId = ctx.from.id;
  
  if (!data.users[userId]) {
    data.users[userId] = { balance: 1000, wins: 0, losses: 0, color: color };
  } else {
    data.users[userId].color = color;
  }
  
  saveData();
  ctx.reply(`🎨 Color updated! You'll be ${color} in battles!`);
});

// Daily bonus
bot.action('daily_bonus', (ctx) => {
  const userId = ctx.from.id;
  const user = data.users[userId];
  const today = new Date().toDateString();
  
  if (!user.lastDailyBonus || user.lastDailyBonus !== today) {
    user.balance += 100;
    user.lastDailyBonus = today;
    saveData();
    ctx.reply(`🎉 Daily bonus claimed! +100 coins!\n\nNew balance: ${user.balance} coins`);
  } else {
    ctx.reply('❌ You already claimed your daily bonus today. Come back tomorrow!');
  }
});

// Create bet command
bot.action('create_bet', async (ctx) => {
    const userId = ctx.from.id;
    const user = data.users[userId];
    
    const betAmounts = [
        { text: '💰 10 coins', amount: 10 },
        { text: '💰 50 coins', amount: 50 },
        { text: '💰 100 coins', amount: 100 },
        { text: '💰 500 coins', amount: 500 }
    ];
    
    ctx.reply('Select bet amount:', {
        reply_markup: {
            inline_keyboard: [
                ...betAmounts.map(bet => [
                    { text: bet.text, callback_data: `create_bet_${bet.amount}` }
                ]),
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        }
    });
});

bot.action(/create_bet_(\d+)/, (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    const user = data.users[userId];
    
    if (user.balance < amount) {
        return ctx.reply('❌ Insufficient balance!');
    }
    
    // Create bet
    const betId = Date.now().toString();
    const bet = {
        id: betId,
        userId: userId,
        amount: amount,
        createdAt: new Date(),
        status: 'open'
    };
    
    if (!data.bets) data.bets = [];
    data.bets.push(bet);
    
    // Deduct amount from user
    user.balance -= amount;
    saveData();
    
    ctx.reply(
        `✅ Bet created!\n\n` +
        `Amount: ${amount} coins\n` +
        `Bet ID: ${betId}\n\n` +
        `Waiting for opponent...`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel Bet', callback_data: `cancel_bet_${betId}` }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
});

// Bet order book
bot.action('order_book', (ctx) => {
    const openBets = (data.bets || []).filter(bet => bet.status === 'open');
    
    if (openBets.length === 0) {
        return ctx.reply('📊 No open bets available. Create one first!');
    }
    
    const betButtons = openBets.map(bet => {
        const user = data.users[bet.userId];
        return [{
            text: `💰 ${bet.amount} coins (${user.wins}W/${user.losses}L)`,
            callback_data: `join_bet_${bet.id}`
        }];
    });
    
    ctx.reply('📊 Open Bets:', {
        reply_markup: {
            inline_keyboard: [
                ...betButtons,
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        }
    });
});

bot.action(/join_bet_(.+)/, (ctx) => {
    const betId = ctx.match[1];
    const userId = ctx.from.id;
    const user = data.users[userId];
    const bet = (data.bets || []).find(b => b.id === betId);
    
    if (!bet) {
        return ctx.reply('❌ Bet not found!');
    }
    
    if (user.balance < bet.amount) {
        return ctx.reply('❌ Insufficient balance to join this bet!');
    }
    
    if (bet.userId === userId) {
        return ctx.reply('❌ Cannot join your own bet!');
    }
    
    // Create game
    const gameId = Date.now().toString();
    const game = {
        id: gameId,
        player1: bet.userId,
        player2: userId,
        betAmount: bet.amount,
        status: 'active',
        createdAt: new Date()
    };
    
    if (!data.games) data.games = [];
    data.games.push(game);
    
    // Update bet status
    bet.status = 'matched';
    bet.matchedWith = userId;
    
    // Deduct amount from joining player
    user.balance -= bet.amount;
    saveData();
    
    // Notify both players
    const player1 = data.users[bet.userId];
    const player2 = user;
    
    ctx.reply(
        `🎮 Bet Matched!\n\n` +
        `Opponent: ${player2.wins}W ${player2.losses}L\n` +
        `Stake: ${bet.amount} coins\n` +
        `Prize: ${bet.amount * 1.9} coins\n\n` +
        `Get ready to battle!`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: '⚔️ Start Battle', web_app: { url: `https://gear-wars.vercel.app/game/?game=${gameId}` } }
                ]]
            }
        }
    );
    
    // Notify the bet creator
    ctx.telegram.sendMessage(bet.userId,
        `🎮 Your bet was matched!\n\n` +
        `Opponent: ${player2.wins}W ${player2.losses}L\n` +
        `Stake: ${bet.amount} coins\n` +
        `Prize: ${bet.amount * 1.9} coins\n\n` +
        `Get ready to battle!`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: '⚔️ Start Battle', web_app: { url: `https://gear-wars.vercel.app/game/?game=${gameId}` } }
                ]]
            }
        }
    );
});

// Main menu action
bot.action('main_menu', (ctx) => {
  ctx.deleteMessage();
  bot.handleUpdate({ message: { text: '/start', from: ctx.from, chat: ctx.chat } });
});

// Handle game results from web app
bot.on('web_app_data', (ctx) => {
  const result = JSON.parse(ctx.webAppData.data.json());
  const userId = ctx.from.id;
  
  if (result.type === 'game_result') {
    if (result.winner === 'player') {
      data.users[userId].wins++;
      data.users[userId].balance += 50; // Win bonus
      ctx.reply(`🎉 Victory! You won 50 coins!\n\nRecord: ${data.users[userId].wins}W - ${data.users[userId].losses}L`);
    } else {
      data.users[userId].losses++;
      ctx.reply(`💔 Defeat! Better luck next time!\n\nRecord: ${data.users[userId].wins}W - ${data.users[userId].losses}L`);
    }
    saveData();
  }
});

// Help command
bot.command('help', (ctx) => {
  ctx.reply(
    `🎮 Gear Wars - Commands:\n\n` +
    `/start - Main menu\n` +
    `/help - This help message\n` +
    `/stats - Your battle statistics\n` +
    `/leaderboard - Top players\n\n` +
    `⚔️ Game Controls:\n` +
    `• PC: Arrow Keys\n` +
    `• Mobile: Touch buttons or tap to move`
  );
});

// Stats command
bot.command('stats', (ctx) => {
  const userId = ctx.from.id;
  const user = data.users[userId];
  
  if (user) {
    const winRate = user.wins + user.losses > 0 
      ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
      : 0;
      
    ctx.reply(
      `📊 Your Stats:\n\n` +
      `Balance: ${user.balance} coins\n` +
      `Record: ${user.wins} Wins - ${user.losses} Losses\n` +
      `Win Rate: ${winRate}%\n` +
      `Color: ${user.color}`
    );
  } else {
    ctx.reply('Please use /start first to create your account!');
  }
});

// Leaderboard command
bot.command('leaderboard', (ctx) => {
  const users = Object.values(data.users);
  const topPlayers = users
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses))
    .slice(0, 5);
  
  let leaderboardText = '🏆 Top Players:\n\n';
  topPlayers.forEach((user, index) => {
    leaderboardText += `${index + 1}. ${user.wins}W - ${user.losses}L\n`;
  });
  
  ctx.reply(leaderboardText || '📊 No players yet!');
});

// ========================================
// SERVER SETUP (CRITICAL FIX)
// ========================================

// Create HTTP server for WebSocket
const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is running! 🤖');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Start server with 0.0.0.0 binding (CRITICAL FOR RENDER)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WebSocket server running on port ${PORT}`);
    console.log(`📡 Accepting connections on 0.0.0.0:${PORT}`);
    
    // Start Telegram bot
    bot.launch()
        .then(() => {
            console.log('✅ Telegram bot started successfully!');
        })
        .catch(err => {
            console.error('❌ Failed to start bot:', err);
            process.exit(1);
        });
});

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 SIGINT received, stopping bot...');
    bot.stop('SIGINT');
    server.close();
});

process.once('SIGTERM', () => {
    console.log('🛑 SIGTERM received, stopping bot...');
    bot.stop('SIGTERM');
    server.close();
}); }

loadData();

// Start command
bot.command('start', (ctx) => {
  const userId = ctx.from.id;
  if (!data.users[userId]) {
    data.users[userId] = { 
      balance: 1000, 
      wins: 0, 
      losses: 0, 
      color: '#3498db',
      lastDailyBonus: null 
    };
    saveData();
  }
  
  const user = data.users[userId];
  ctx.reply(
    `🎮 Gear Wars - Battle Arena\n\n` +
    `Balance: ${user.balance} coins\n` +
    `Wins: ${user.wins} | Losses: ${user.losses}\n\n` +
    `Choose an action:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚔️ Quick Battle (VS AI)', web_app: { url: 'https://gear-wars.vercel.app/' } }],
          [{ text: '💰 Create Bet', callback_data: 'create_bet' }],
          [{ text: '📊 Order Book', callback_data: 'order_book' }],
          [{ text: '🎨 Change Color', callback_data: 'change_color' }],
          [{ text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }]
        ]
      }
    }
  );
});

// Color selection
bot.action('change_color', (ctx) => {
  const colors = [
    { text: '🔴 Red', color: '#e74c3c' },
    { text: '🔵 Blue', color: '#3498db' },
    { text: '🟢 Green', color: '#2ecc71' },
    { text: '🟡 Yellow', color: '#f1c40f' },
    { text: '🟣 Purple', color: '#9b59b6' },
    { text: '🟠 Orange', color: '#e67e22' }
  ];
  
  ctx.reply('Choose your battle color:', {
    reply_markup: {
      inline_keyboard: colors.map(c => [
        { text: c.text, callback_data: `setcolor_${c.color}` }
      ])
    }
  });
});

bot.action(/setcolor_(.+)/, (ctx) => {
  const color = ctx.match[1];
  const userId = ctx.from.id;
  
  if (!data.users[userId]) {
    data.users[userId] = { balance: 1000, wins: 0, losses: 0, color: color };
  } else {
    data.users[userId].color = color;
  }
  
  saveData();
  ctx.reply(`🎨 Color updated! You'll be ${color} in battles!`);
});

// Daily bonus
bot.action('daily_bonus', (ctx) => {
  const userId = ctx.from.id;
  const user = data.users[userId];
  const today = new Date().toDateString();
  
  if (!user.lastDailyBonus || user.lastDailyBonus !== today) {
    user.balance += 100;
    user.lastDailyBonus = today;
    saveData();
    ctx.reply(`🎉 Daily bonus claimed! +100 coins!\n\nNew balance: ${user.balance} coins`);
  } else {
    ctx.reply('❌ You already claimed your daily bonus today. Come back tomorrow!');
  }
});

// Create bet placeholder
bot.action('create_bet', (ctx) => {
  ctx.reply('💰 Bet creation coming soon! For now, use Quick Battle to play vs AI.');
});

// Order book placeholder
bot.action('order_book', (ctx) => {
  ctx.reply('📊 Order book feature coming soon! For now, use Quick Battle to play vs AI.');
});

// Handle game results from web app
bot.on('web_app_data', (ctx) => {
  const result = JSON.parse(ctx.webAppData.data.json());
  const userId = ctx.from.id;
  
  if (result.type === 'game_result') {
    if (result.winner === 'player') {
      data.users[userId].wins++;
      data.users[userId].balance += 50; // Win bonus
      ctx.reply(`🎉 Victory! You won 50 coins!\n\nRecord: ${data.users[userId].wins}W - ${data.users[userId].losses}L`);
    } else {
      data.users[userId].losses++;
      ctx.reply(`💔 Defeat! Better luck next time!\n\nRecord: ${data.users[userId].wins}W - ${data.users[userId].losses}L`);
    }
    saveData();
  }
});

// Help command
bot.command('help', (ctx) => {
  ctx.reply(
    `🎮 Gear Wars - Commands:\n\n` +
    `/start - Main menu\n` +
    `/help - This help message\n` +
    `/stats - Your battle statistics\n` +
    `/leaderboard - Top players (coming soon)\n\n` +
    `⚔️ Game Controls:\n` +
    `• PC: Arrow Keys\n` +
    `• Mobile: Touch buttons or tap to move`
  );
});

// Stats command
bot.command('stats', (ctx) => {
  const userId = ctx.from.id;
  const user = data.users[userId];
  
  if (user) {
    const winRate = user.wins + user.losses > 0 
      ? ((user.wins / (user.wins + user.losses)) * 100).toFixed(1)
      : 0;
      
    ctx.reply(
      `📊 Your Stats:\n\n` +
      `Balance: ${user.balance} coins\n` +
      `Record: ${user.wins} Wins - ${user.losses} Losses\n` +
      `Win Rate: ${winRate}%\n` +
      `Color: ${user.color}`
    );
  } else {
    ctx.reply('Please use /start first to create your account!');
  }
});

// Leaderboard placeholder
bot.command('leaderboard', (ctx) => {
  const users = Object.values(data.users);
  const topPlayers = users
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses))
    .slice(0, 5);
  
  let leaderboardText = '🏆 Top Players:\n\n';
  topPlayers.forEach((user, index) => {
    leaderboardText += `${index + 1}. ${user.wins}W - ${user.losses}L\n`;
  });
  
  ctx.reply(leaderboardText);
});

console.log('🤖 Bot starting...');
bot.launch();
console.log('✅ Bot started successfully!');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

 // Add to bot/bot.js

// Create bet command
bot.action('create_bet', async (ctx) => {
    const userId = ctx.from.id;
    const user = data.users[userId];
    
    const betAmounts = [
        { text: '💰 10 coins', amount: 10 },
        { text: '💰 50 coins', amount: 50 },
        { text: '💰 100 coins', amount: 100 },
        { text: '💰 500 coins', amount: 500 }
    ];
    
    ctx.reply('Select bet amount:', {
        reply_markup: {
            inline_keyboard: [
                ...betAmounts.map(bet => [
                    { text: bet.text, callback_data: `create_bet_${bet.amount}` }
                ]),
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        }
    });
});

bot.action(/create_bet_(\d+)/, (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    const user = data.users[userId];
    
    if (user.balance < amount) {
        return ctx.reply('❌ Insufficient balance!');
    }
    
    // Create bet
    const betId = Date.now().toString();
    const bet = {
        id: betId,
        userId: userId,
        amount: amount,
        createdAt: new Date(),
        status: 'open'
    };
    
    if (!data.bets) data.bets = [];
    data.bets.push(bet);
    
    // Deduct amount from user
    user.balance -= amount;
    saveData();
    
    ctx.reply(
        `✅ Bet created!\n\n` +
        `Amount: ${amount} coins\n` +
        `Bet ID: ${betId}\n\n` +
        `Waiting for opponent...`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel Bet', callback_data: `cancel_bet_${betId}` }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
});

// Bet order book
bot.action('order_book', (ctx) => {
    const openBets = (data.bets || []).filter(bet => bet.status === 'open');
    
    if (openBets.length === 0) {
        return ctx.reply('📊 No open bets available. Create one first!');
    }
    
    const betButtons = openBets.map(bet => {
        const user = data.users[bet.userId];
        return [{
            text: `💰 ${bet.amount} coins (${user.wins}W/${user.losses}L)`,
            callback_data: `join_bet_${bet.id}`
        }];
    });
    
    ctx.reply('📊 Open Bets:', {
        reply_markup: {
            inline_keyboard: [
                ...betButtons,
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        }
    });
});

bot.action(/join_bet_(.+)/, (ctx) => {
    const betId = ctx.match[1];
    const userId = ctx.from.id;
    const user = data.users[userId];
    const bet = (data.bets || []).find(b => b.id === betId);
    
    if (!bet) {
        return ctx.reply('❌ Bet not found!');
    }
    
    if (user.balance < bet.amount) {
        return ctx.reply('❌ Insufficient balance to join this bet!');
    }
    
    if (bet.userId === userId) {
        return ctx.reply('❌ Cannot join your own bet!');
    }
    
    // Create game
    const gameId = Date.now().toString();
    const game = {
        id: gameId,
        player1: bet.userId,
        player2: userId,
        betAmount: bet.amount,
        status: 'active',
        createdAt: new Date()
    };
    
    if (!data.games) data.games = [];
    data.games.push(game);
    
    // Update bet status
    bet.status = 'matched';
    bet.matchedWith = userId;
    
    // Deduct amount from joining player
    user.balance -= bet.amount;
    saveData();
    
    // Notify both players
    const player1 = data.users[bet.userId];
    const player2 = user;
    
    ctx.reply(
        `🎮 Bet Matched!\n\n` +
        `Opponent: ${player2.wins}W ${player2.losses}L\n` +
        `Stake: ${bet.amount} coins\n` +
        `Prize: ${bet.amount * 1.9} coins\n\n` +
        `Get ready to battle!`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: '⚔️ Start Battle', web_app: { url: `https://yourapp.com/game/?game=${gameId}` } }
                ]]
            }
        }
    );
    
    // Notify the bet creator
    ctx.telegram.sendMessage(bet.userId,
        `🎮 Your bet was matched!\n\n` +
        `Opponent: ${player2.wins}W ${player2.losses}L\n` +
        `Stake: ${bet.amount} coins\n` +
        `Prize: ${bet.amount * 1.9} coins\n\n` +
        `Get ready to battle!`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: '⚔️ Start Battle', web_app: { url: `https://yourapp.com/game/?game=${gameId}` } }
                ]]
            }
        }
    );
}); 



