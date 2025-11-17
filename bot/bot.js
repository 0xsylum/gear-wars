const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN || '8278879171:AAHIurrSFNEjuuwh3GRyofKSYja821vVwUc');
let data = { users: {}, orders: [], games: [] };

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
          [{ text: '⚔️ Quick Battle (VS AI)', web_app: { url: 'https://your-app.com/game/' } }],
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

