const { Telegraf } = require('telegraf');
const fs = require('fs');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
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
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2)); 
}

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
      username: ctx.from.username || 'Anonymous',
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
          [{ text: '⚔️ Quick Battle (VS AI)', web_app: { url: 'https://gear-wars.vercel.app/?mode=ai' } }],
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
      inline_keyboard: colors.map(c => [{ text: c.text, callback_data: `setcolor_${c.color}` }])
    }
  });
});

bot.action(/setcolor_(.+)/, (ctx) => {
  const color = ctx.match[1];
  const userId = ctx.from.id;
  
  if (!data.users[userId]) data.users[userId] = { balance: 1000, wins: 0, losses: 0 };
  data.users[userId].color = color;
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
    ctx.reply(`🎉 Daily bonus claimed! +100 coins!\nNew balance: ${user.balance} coins`);
  } else {
    ctx.reply('❌ You already claimed your daily bonus today. Come back tomorrow!');
  }
});

// BET SYSTEM - FULLY WORKING
bot.action('create_bet', async (ctx) => {
  const userId = ctx.from.id;
  const user = data.users[userId];
  
  if (user.balance < 10) return ctx.reply('❌ Need at least 10 coins to bet!');
  
  const betAmounts = [
    { text: '💰 10 coins', amount: 10 },
    { text: '💰 50 coins', amount: 50 },
    { text: '💰 100 coins', amount: 100 },
    { text: '💰 500 coins', amount: 500 }
  ];
  
  ctx.reply('Select bet amount:', {
    reply_markup: {
      inline_keyboard: betAmounts.map(bet => [
        { text: bet.text, callback_data: `bet_amount_${bet.amount}` }
      ]).concat([[{ text: '❌ Cancel', callback_data: 'create_bet_cancel' }]])
    }
  });
});

bot.action(/bet_amount_(\d+)/, (ctx) => {
  const amount = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const user = data.users[userId];
  
  if (user.balance < amount) return ctx.reply('❌ Insufficient balance!');
  
  const betId = uuidv4().substring(0, 8);
  user.balance -= amount;
  
  const bet = {
    id: betId,
    userId,
    username: user.username,
    amount,
    status: 'open',
    timestamp: Date.now()
  };
  
  data.bets.push(bet);
  saveData();
  
  ctx.reply(
    `✅ Bet created!\n\n` +
    `💰 Amount: ${amount} coins\n` +
    `🆔 ID: \`${betId}\`\n\n` +
    `Waiting for opponent...`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancel Bet', callback_data: `cancel_bet_${betId}` }
        ]]
      }
    }
  );
});

bot.action(/cancel_bet_(.+)/, (ctx) => {
  const betId = ctx.match[1];
  const userId = ctx.from.id;
  const bet = data.bets.find(b => b.id === betId && b.userId === userId && b.status === 'open');
  
  if (!bet) return ctx.answerCbQuery('❌ Bet not found or already matched.');
  
  data.users[userId].balance += bet.amount;
  bet.status = 'cancelled';
  data.bets = data.bets.filter(b => b.id !== betId);
  saveData();
  
  ctx.reply(`✅ Bet ${betId} cancelled. Refunded ${bet.amount} coins.`);
});

bot.action('order_book', (ctx) => {
  const openBets = data.bets.filter(bet => bet.status === 'open');
  
  if (openBets.length === 0) {
    return ctx.reply('📊 No open bets! Be the first to create one.');
  }
  
  const betList = openBets.slice(0, 10).map(bet => 
    `💰 ${bet.amount} coins - @${bet.username}\n🆔 \`${bet.id}\``
  ).join('\n\n');
  
  ctx.reply(
    `📊 Open Bets:\n\n${betList}\n\n` +
    `Click any bet ID below to accept:`,
    {
      reply_markup: {
        inline_keyboard: openBets.slice(0, 10).map(bet => [{
          text: `⚔️ Accept ${bet.amount} (@${bet.username})`,
          callback_data: `accept_bet_${bet.id}`
        }])
      }
    }
  );
});

bot.action(/accept_bet_(.+)/, async (ctx) => {
  const betId = ctx.match[1];
  const acceptorId = ctx.from.id;
  const acceptor = data.users[acceptorId];
  
  if (!acceptor) return ctx.reply('❌ Please /start first!');
  
  const bet = data.bets.find(b => b.id === betId && b.status === 'open');
  if (!bet) return ctx.answerCbQuery('❌ Bet expired or taken!');
  
  if (acceptor.balance < bet.amount) {
    return ctx.reply('❌ Insufficient balance to accept bet!');
  }
  
  // Deduct stake from acceptor
  acceptor.balance -= bet.amount;
  
  // Create game room
  const gameId = uuidv4().substring(0, 8);
  const game = {
    id: gameId,
    player1: bet.userId,
    player2: acceptorId,
    betAmount: bet.amount,
    status: 'active',
    startTime: Date.now()
  };
  
  data.games.push(game);
  bet.status = 'matched';
  saveData();
  
  // Notify both players
  const webAppUrl = `https://gear-wars.vercel.app/?game=${gameId}&p=${acceptorId === bet.userId ? '1' : '2'}`;
  
  ctx.reply(
    `🎮 MATCH FOUND!\n\n` +
    `💰 Stake: ${bet.amount} coins\n` +
    `⚔️ Launch battle:`,
    { reply_markup: { inline_keyboard: [[{ text: '🚀 START BATTLE', web_app: { url: webAppUrl } }]] } }
  );
  
  bot.telegram.sendMessage(
    bet.userId,
    `🎮 MATCH FOUND!\n\n💰 Stake: ${bet.amount} coins\n⚔️ Opponent: @${acceptor.username || 'Anonymous'}\n\n🚀 Launch battle:`,
    { reply_markup: { inline_keyboard: [[{ text: '🚀 START BATTLE', web_app: { url: webAppUrl.replace(`&p=2`, '&p=1') } }]] } }
  );
});

// GAME RESULT HANDLER - FULLY FIXED
bot.on('web_app_data', async (ctx) => {
  try {
    const result = JSON.parse(ctx.webAppData.data);
    const userId = ctx.from.id;
    
    if (result.type === 'game_result') {
      if (result.gameId) {
        // MULTIPLAYER BET - PAY WINNER
        const game = data.games.find(g => g.id === result.gameId && g.status === 'active');
        if (!game) return ctx.reply('❌ Invalid game.');
        
        const winnerId = result.winnerId === game.player1 ? game.player1 : game.player2;
        const loserId = winnerId === game.player1 ? game.player2 : game.player1;
        const prize = Math.floor(game.betAmount * 1.9); // 5% house rake
        
        // Update stats
        data.users[winnerId].wins++;
        data.users[loserId].losses++;
        data.users[winnerId].balance += prize;
        
        game.status = 'completed';
        saveData();
        
        // Notify winner
        ctx.reply(
          `🎉 VICTORY! 🏆\n\n` +
          `+${prize} coins (${game.betAmount * 2} pot - 5% fee)\n` +
          `Record: ${data.users[winnerId].wins}W-${data.users[winnerId].losses}L`
        );
        
        // Notify loser
        bot.telegram.sendMessage(
          loserId,
          `💔 DEFEAT!\n\n` +
          `-${game.betAmount} coins\n` +
          `Record: ${data.users[loserId].wins}W-${data.users[loserId].losses}L`
        );
        
      } else {
        // AI GAME
        if (result.winner === 'player') {
          data.users[userId].wins++;
          data.users[userId].balance += 50;
          ctx.reply(`🎉 Victory vs AI! +50 coins!\nRecord: ${data.users[userId].wins}W-${data.users[userId].losses}L`);
        } else {
          data.users[userId].losses++;
          ctx.reply(`💔 Defeat! Better luck next time!\nRecord: ${data.users[userId].wins}W-${data.users[userId].losses}L`);
        }
        saveData();
      }
    }
  } catch (error) {
    console.error('Web app data error:', error);
  }
});

// Stats & Leaderboard
bot.command('stats', (ctx) => {
  const userId = ctx.from.id;
  const user = data.users[userId];
  if (!user) return ctx.reply('Use /start first!');
  
  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? ((user.wins / totalGames) * 100).toFixed(1) : 0;
  
  ctx.reply(
    `📊 Your Stats:\n\n` +
    `💰 Balance: ${user.balance} coins\n` +
    `⚔️ Record: ${user.wins}W-${user.losses}L\n` +
    `📈 Win Rate: ${winRate}%\n` +
    `🎨 Color: ${user.color}`
  );
});

bot.command('leaderboard', (ctx) => {
  const users = Object.values(data.users);
  const topPlayers = users
    .filter(user => user.wins + user.losses > 0)
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses))
    .slice(0, 10);
  
  if (topPlayers.length === 0) return ctx.reply('🏆 No players yet! Be the first!');
  
  let lbText = '🏆 TOP PLAYERS:\n\n';
  topPlayers.forEach((user, i) => {
    const net = user.wins - user.losses;
    lbText += `${i+1}. @${user.username || 'Anonymous'}\n   ${net > 0 ? '+' : ''}${net} (${user.wins}W/${user.losses}L)\n\n`;
  });
  
  ctx.reply(lbText);
});

// Server setup (unchanged)
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running! 🤖');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  bot.launch().then(() => console.log('✅ Bot started!'));
});

process.once('SIGINT', () => { bot.stop(); server.close(); });
process.once('SIGTERM', () => { bot.stop(); server.close(); });
