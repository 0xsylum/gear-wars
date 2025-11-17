const { Telegraf } = require('telegraf');
const fs = require('fs');
const http = require('http');
const { wss } = require('./websocket');
const { v4: uuidv4 } = require('uuid');

const bot = new Telegraf(process.env.BOT_TOKEN || '8278879171:AAHIurrSFNEjuuwh3GRyofKSYja821vVwUc');
let data = { users: {}, bets: [], games: [] };

function loadData() {
  try { data = JSON.parse(fs.readFileSync('data.json')); } 
  catch (e) { console.log('Fresh start - no data.json'); }
}
function saveData() {
  try { fs.writeFileSync('data.json', JSON.stringify(data, null, 2)); }
  catch (e) { console.error('Save failed:', e); }
}
loadData();

// START
bot.start((ctx) => {
  const id = ctx.from.id;
  if (!data.users[id]) {
    data.users[id] = { balance: 1000, wins: 0, losses: 0, color: '#3498db', lastDaily: null };
    saveData();
  }

  const u = data.users[id];
  ctx.reply(
    `Gear Wars - Battle Arena\n\n` +
    `Balance: ${u.balance} coins\n` +
    `Wins: ${u.wins} - ${u.losses} Losses\n\n` +
    `Choose action:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Quick Battle (VS AI)', web_app: { url: 'https://gear-wars.vercel.app/' } }],
          [{ text: 'Create Bet', callback_data: 'create_bet' }],
          [{ text: 'Order Book', callback_data: 'order_book' }],
          [{ text: 'Change Color', callback_data: 'change_color' }],
          [{ text: 'Daily Bonus', callback_data: 'daily_bonus' }]
        ]
      }
    }
  );
});

// DAILY BONUS
bot.action('daily_bonus', async (ctx) => {
  await ctx.answerCbQuery();
  const id = ctx.from.id;
  const today = new Date().toDateString();
  if (data.users[id].lastDaily !== today) {
    data.users[id].balance += 100;
    data.users[id].lastDaily = today;
    saveData();
    ctx.reply(`+100 coins daily bonus!\nBalance: ${data.users[id].balance}`);
  } else {
    ctx.reply('Already claimed today!');
  }
});

// CHANGE COLOR (your original stays untouched)
bot.action('change_color', (ctx) => {
  ctx.reply('Choose color:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Red', callback_data: 'setcolor_#e74c3c' }],
        [{ text: 'Blue', callback_data: 'setcolor_#3498db' }],
        [{ text: 'Green', callback_data: 'setcolor_#2ecc71' }],
        [{ text: 'Yellow', callback_data: 'setcolor_#f1c40f' }],
        [{ text: 'Purple', callback_data: 'setcolor_#9b59b6' }],
        [{ text: 'Orange', callback_data: 'setcolor_#e67e22' }]
      ]
    }
  });
});
bot.action(/setcolor_(.+)/, (ctx) => {
  const color = ctx.match[1];
  data.users[ctx.from.id].color = color;
  saveData();
  ctx.reply(`Color set to ${color}`);
});

// CREATE BET - FULLY WORKING
bot.action('create_bet', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply('Select amount:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '10 coins', callback_data: 'bet_10' }],
        [{ text: '50 coins', callback_data: 'bet_50' }],
        [{ text: '100 coins', callback_data: 'bet_100' }],
        [{ text: '500 coins', callback_data: 'bet_500' }],
        [{ text: 'Cancel', callback_data: 'cancel' }]
      ]
    }
  });
});

bot.action(/bet_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const amount = Number(ctx.match[1]);
  const id = ctx.from.id;
  if (data.users[id].balance < amount) return ctx.reply('Not enough coins!');

  data.users[id].balance -= amount;
  const betId = uuidv4().slice(0, 8);
  data.bets.push({ id: betId, userId: id, amount, status: 'open' });
  saveData();

  ctx.reply(
    `Bet created!\nAmount: ${amount} coins\nID: \`${betId}\`\nWaiting for opponent...`,
    { reply_markup: { inline_keyboard: [[{ text: 'Cancel Bet', callback_data: `cancel_${betId}` }]] } }
  );
});

bot.action(/cancel_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const betId = ctx.match[1];
  const bet = data.bets.find(b => b.id === betId && b.userId === ctx.from.id && b.status === 'open');
  if (!bet) return ctx.reply('Bet not found or already taken');
  data.users[ctx.from.id].balance += bet.amount;
  data.bets = data.bets.filter(b => b.id !== betId);
  saveData();
  ctx.reply('Bet cancelled - coins refunded');
});

// ORDER BOOK - 100% WORKING
bot.action('order_book', async (ctx) => {
  await ctx.answerCbQuery();
  const open = data.bets.filter(b => b.status === 'open');
  if (open.length === 0) {
    return ctx.editMessageText ? ctx.editMessageText('No open bets', { reply_markup: { inline_keyboard: [[{ text: 'Refresh', callback_data: 'order_book' }]] } }) 
      : ctx.reply('No open bets', { reply_markup: { inline_keyboard: [[{ text: 'Refresh', callback_data: 'order_book' }]] } });
  }

  const keyboard = open.map(bet => [{
    text: `${bet.amount} coins`,
    callback_data: `accept_${bet.id}`
  }]);
  keyboard.push([{ text: 'Refresh', callback_data: 'order_book' }]);

  const text = open.map(b => `${b.amount} coins (ID: ${b.id})`).join('\n');
  ctx.editMessageText ? ctx.editMessageText(`OPEN BETS:\n\n${text}`, { reply_markup: { inline_keyboard: keyboard } })
    : ctx.reply(`OPEN BETS:\n\n${text}`, { reply_markup: { inline_keyboard: keyboard } });
});

bot.action(/accept_(.+)/, async (ctx) => {
  await ctx.answerCbQuery('Starting battle...');
  const betId = ctx.match[1];
  const bet = data.bets.find(b => b.id === betId && b.status === 'open');
  if (!bet) return ctx.reply('Bet no longer available');

  const p1 = bet.userId;
  const p2 = ctx.from.id;
  if (p1 === p2) return ctx.reply('Cannot accept own bet');
  if (data.users[p2].balance < bet.amount) return ctx.reply('Not enough coins');

  data.users[p2].balance -= bet.amount;
  bet.status = 'matched';
  const gameId = uuidv4().slice(0, 8);
  data.games.push({ id: gameId, p1, p2, amount: bet.amount });
  saveData();

  const url = `https://gear-wars.vercel.app/?game=${gameId}`;

  // Launch both
  ctx.reply(`Battle found!\nStake: ${bet.amount} coins`, {
    reply_markup: { inline_keyboard: [[{ text: 'LAUNCH', web_app: { url } }]] }
  });
  bot.telegram.sendMessage(p1, `Opponent accepted!\nStake: ${bet.amount} coins`, {
    reply_markup: { inline_keyboard: [[{ text: 'LAUNCH', web_app: { url } }]] }
  });
});

// RESULT HANDLER - FIXED
bot.on('web_app_data', async (ctx) => {
  try {
    const payload = JSON.parse(ctx.webAppData.data);
    const userId = ctx.from.id;

    if (payload.gameId) {
      const game = data.games.find(g => g.id === payload.gameId);
      if (!game) return;

      const winner = payload.winnerId === game.p1 ? game.p1 : game.p2;
      const loser = winner === game.p1 ? game.p2 : game.p1;
      const prize = Math.floor(game.amount * 1.9);

      data.users[winner].wins++;
      data.users[winner].balance += prize;
      data.users[loser].losses++;

      ctx.reply(`VICTORY! +${prize} coins (5% fee)`);
      bot.telegram.sendMessage(loser, `DEFEAT! -${game.amount} coins`);
    } else if (payload.winner === 'player') {
      data.users[userId].wins++;
      data.users[userId].balance += 50;
      ctx.reply(`AI defeated! +50 coins`);
    } else {
      data.users[userId].losses++;
      ctx.reply(`Lost to AI`);
    }
    saveData();
  } catch (e) { console.error(e); }
});

// SERVER (unchanged)
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') { res.end('OK'); }
  else { res.writeHead(404); res.end(); }
});
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Bot + WS running');
  bot.launch();
});
