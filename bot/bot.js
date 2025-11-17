const { Telegraf } = require('telegraf');
const fs = require('fs');
const http = require('http');
const WebSocketManager = require('./websocket');

// Initialize bot with environment variable
const bot = new Telegraf(process.env.BOT_TOKEN);
const wsManager = new WebSocketManager();

// Data structure
let data = { 
    users: {}, 
    orders: [], 
    games: [], 
    bets: [],
    leaderboard: {}
};

// Load/save data with error handling
function loadData() {
    try {
        if (fs.existsSync('data.json')) {
            const fileData = fs.readFileSync('data.json', 'utf8');
            data = JSON.parse(fileData);
            console.log('✅ Data loaded successfully');
        }
    } catch (error) {
        console.log('⚠️ No data file or corrupt, starting fresh');
        initializeDefaultData();
    }
}

function saveData() {
    try {
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        console.log('💾 Data saved successfully');
    } catch (error) {
        console.error('❌ Failed to save data:', error);
    }
}

function initializeDefaultData() {
    data = {
        users: {},
        orders: [],
        games: [],
        bets: [],
        leaderboard: {},
        statistics: {
            totalGames: 0,
            totalBets: 0,
            totalCoinsWagered: 0
        }
    };
}

loadData();

// ========================================
// HELPER FUNCTIONS
// ========================================

function ensureUser(userId) {
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 1000,
            wins: 0,
            losses: 0,
            color: '#3498db',
            lastDailyBonus: null,
            joinedAt: new Date().toISOString(),
            totalEarnings: 0
        };
        saveData();
    }
    return data.users[userId];
}

function formatBalance(balance) {
    return balance.toLocaleString();
}

function getWinRate(user) {
    const totalGames = user.wins + user.losses;
    return totalGames > 0 ? ((user.wins / totalGames) * 100).toFixed(1) : 0;
}

// ========================================
// BOT COMMANDS & HANDLERS
// ========================================

bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    const welcomeMessage = `
🎮 *Gear Wars - Battle Arena*

*Your Stats:*
💰 Balance: *${formatBalance(user.balance)} coins*
📊 Record: *${user.wins}W - ${user.losses}L*
🎯 Win Rate: *${getWinRate(user)}%*
🎨 Color: ${user.color}

*Choose an action below:*`;

    ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚔️ Quick Battle (VS AI)', web_app: { url: 'https://gear-wars.vercel.app/' } }],
                [{ text: '🕹️ Multiplayer Battle', callback_data: 'multiplayer_menu' }],
                [{ text: '💰 Create Bet', callback_data: 'create_bet' }, { text: '📊 Betting Lobby', callback_data: 'bet_lobby' }],
                [{ text: '🎨 Change Color', callback_data: 'change_color' }, { text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }],
                [{ text: '📈 Statistics', callback_data: 'stats' }, { text: '🏆 Leaderboard', callback_data: 'leaderboard' }]
            ]
        }
    });
});

// Color selection
bot.action('change_color', (ctx) => {
    const colors = [
        { text: '🔴 Red', color: '#e74c3c' },
        { text: '🔵 Blue', color: '#3498db' },
        { text: '🟢 Green', color: '#2ecc71' },
        { text: '🟡 Yellow', color: '#f1c40f' },
        { text: '🟣 Purple', color: '#9b59b6' },
        { text: '🟠 Orange', color: '#e67e22' },
        { text: '⚪ White', color: '#ecf0f1' },
        { text: '⚫ Black', color: '#2c3e50' }
    ];
    
    ctx.editMessageText('🎨 *Choose your battle color:*', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                ...colors.map(c => [{ text: c.text, callback_data: `setcolor_${c.color}` }]),
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        }
    });
});

bot.action(/setcolor_(.+)/, (ctx) => {
    const color = ctx.match[1];
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    user.color = color;
    saveData();
    
    ctx.answerCbQuery(`✅ Color set to ${color}!`);
    ctx.editMessageText(`🎨 *Color Updated!*\n\nYou'll appear as ${color} in battles!`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
        }
    });
});

// Daily bonus
bot.action('daily_bonus', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    const today = new Date().toDateString();
    
    if (!user.lastDailyBonus || user.lastDailyBonus !== today) {
        const bonus = 100 + Math.floor(Math.random() * 50); // 100-150 coins
        user.balance += bonus;
        user.lastDailyBonus = today;
        saveData();
        
        ctx.answerCbQuery(`🎉 +${bonus} coins!`);
        ctx.editMessageText(
            `🎁 *Daily Bonus Claimed!*\n\n` +
            `💰 Received: *+${bonus} coins*\n` +
            `🏦 New Balance: *${formatBalance(user.balance)} coins*\n\n` +
            `*Come back tomorrow for more!*`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
                }
            }
        );
    } else {
        ctx.answerCbQuery('❌ Already claimed today!');
        ctx.editMessageText(
            '❌ *Bonus Already Claimed*\n\nYou already collected your daily bonus today. Come back tomorrow!',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
                }
            }
        );
    }
});

// Betting system
bot.action('create_bet', async (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    const betAmounts = [
        { text: '💰 10 coins', amount: 10 },
        { text: '💰 50 coins', amount: 50 },
        { text: '💰 100 coins', amount: 100 },
        { text: '💰 250 coins', amount: 250 },
        { text: '💰 500 coins', amount: 500 },
        { text: '💰 1000 coins', amount: 1000 }
    ];
    
    ctx.editMessageText('🎯 *Create a Bet*\n\nSelect your wager amount:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                ...betAmounts.map(bet => [
                    { 
                        text: user.balance >= bet.amount ? bet.text : `${bet.text} ❌`, 
                        callback_data: user.balance >= bet.amount ? `create_bet_${bet.amount}` : 'insufficient_funds'
                    }
                ]),
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        }
    });
});

bot.action('insufficient_funds', (ctx) => {
    ctx.answerCbQuery('❌ Insufficient balance!');
});

bot.action(/create_bet_(\d+)/, (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    if (user.balance < amount) {
        ctx.answerCbQuery('❌ Insufficient balance!');
        return;
    }
    
    // Create bet
    const betId = Date.now().toString();
    const bet = {
        id: betId,
        userId: userId,
        username: ctx.from.username || ctx.from.first_name,
        amount: amount,
        createdAt: new Date(),
        status: 'open',
        expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
    };
    
    if (!data.bets) data.bets = [];
    data.bets.push(bet);
    
    // Deduct amount from user
    user.balance -= amount;
    data.statistics.totalBets = (data.statistics.totalBets || 0) + 1;
    data.statistics.totalCoinsWagered = (data.statistics.totalCoinsWagered || 0) + amount;
    saveData();
    
    ctx.answerCbQuery('✅ Bet created!');
    ctx.editMessageText(
        `🎯 *Bet Created Successfully!*\n\n` +
        `💰 Amount: *${formatBalance(amount)} coins*\n` +
        `🆔 Bet ID: \`${betId}\`\n` +
        `⏰ Expires: 30 minutes\n\n` +
        `*Share the Bet ID with friends or wait for opponents in the lobby!*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 View Betting Lobby', callback_data: 'bet_lobby' }],
                    [{ text: '❌ Cancel Bet', callback_data: `cancel_bet_${betId}` }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
});

// Bet lobby
bot.action('bet_lobby', (ctx) => {
    const openBets = (data.bets || []).filter(bet => 
        bet.status === 'open' && bet.expiresAt > Date.now()
    );
    
    if (openBets.length === 0) {
        return ctx.editMessageText(
            '📊 *Betting Lobby*\n\nNo open bets available. Be the first to create one!',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💰 Create New Bet', callback_data: 'create_bet' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
                    ]
                }
            }
        );
    }
    
    const betButtons = openBets.map(bet => {
        const creator = data.users[bet.userId];
        const timeLeft = Math.max(0, Math.floor((bet.expiresAt - Date.now()) / 60000));
        
        return [{
            text: `💰 ${formatBalance(bet.amount)} coins • ${creator.wins}W/${creator.losses}L • ${timeLeft}m`,
            callback_data: `join_bet_${bet.id}`
        }];
    });
    
    ctx.editMessageText(
        `📊 *Betting Lobby*\n\n*Available Bets:*\n${openBets.length} open bet${openBets.length !== 1 ? 's' : ''}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    ...betButtons,
                    [{ text: '💰 Create New Bet', callback_data: 'create_bet' }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
});

bot.action(/join_bet_(.+)/, async (ctx) => {
    const betId = ctx.match[1];
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    const bet = (data.bets || []).find(b => b.id === betId);
    
    if (!bet) {
        ctx.answerCbQuery('❌ Bet not found!');
        return;
    }
    
    if (user.balance < bet.amount) {
        ctx.answerCbQuery('❌ Insufficient balance!');
        return;
    }
    
    if (bet.userId === userId) {
        ctx.answerCbQuery('❌ Cannot join your own bet!');
        return;
    }
    
    if (bet.expiresAt <= Date.now()) {
        ctx.answerCbQuery('❌ Bet has expired!');
        return;
    }
    
    // Create game
    const gameId = Date.now().toString();
    const game = {
        id: gameId,
        player1: bet.userId,
        player2: userId,
        betAmount: bet.amount,
        status: 'matched',
        createdAt: new Date(),
        betId: betId
    };
    
    if (!data.games) data.games = [];
    data.games.push(game);
    
    // Update bet status
    bet.status = 'matched';
    bet.matchedWith = userId;
    bet.matchedAt = new Date();
    
    // Deduct amount from joining player
    user.balance -= bet.amount;
    saveData();
    
    ctx.answerCbQuery('✅ Bet matched! Starting game...');
    
    const player1 = data.users[bet.userId];
    const player2 = user;
    const totalPrize = bet.amount * 2;
    const winnerPrize = Math.floor(totalPrize * 0.95); // 5% house edge
    
    const gameMessage = `
🎮 *Bet Matched!*

*Opponent:* ${player2.wins}W ${player2.losses}L
💰 *Stake:* ${formatBalance(bet.amount)} coins
🏆 *Prize:* ${formatBalance(winnerPrize)} coins

*Get ready to battle!*`;

    // Notify both players
    try {
        await ctx.editMessageText(gameMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '⚔️ Start Battle', web_app: { url: `https://gear-wars.vercel.app/?game=${gameId}&player=2` } }
                ]]
            }
        });
        
        await ctx.telegram.sendMessage(
            bet.userId,
            gameMessage,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⚔️ Start Battle', web_app: { url: `https://gear-wars.vercel.app/?game=${gameId}&player=1` } }
                    ]]
                }
            }
        );
    } catch (error) {
        console.error('Error sending game notifications:', error);
    }
});

// Cancel bet
bot.action(/cancel_bet_(.+)/, (ctx) => {
    const betId = ctx.match[1];
    const userId = ctx.from.id;
    const bet = (data.bets || []).find(b => b.id === betId && b.userId === userId);
    
    if (!bet) {
        ctx.answerCbQuery('❌ Bet not found!');
        return;
    }
    
    if (bet.status !== 'open') {
        ctx.answerCbQuery('❌ Cannot cancel matched bet!');
        return;
    }
    
    // Refund
    const user = ensureUser(userId);
    user.balance += bet.amount;
    bet.status = 'cancelled';
    saveData();
    
    ctx.answerCbQuery('✅ Bet cancelled!');
    ctx.editMessageText(
        '✅ *Bet Cancelled*\n\nYour wager has been refunded to your balance.',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
            }
        }
    );
});

// Statistics
bot.action('stats', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    const stats = data.statistics || {};
    
    const statsMessage = `
📈 *Your Statistics*

*Personal:*
💰 Balance: ${formatBalance(user.balance)} coins
📊 Record: ${user.wins}W - ${user.losses}L
🎯 Win Rate: ${getWinRate(user)}%
🏆 Total Earnings: ${formatBalance(user.totalEarnings || 0)} coins

*Global:*
🎮 Total Games: ${stats.totalGames || 0}
💰 Total Bets: ${stats.totalBets || 0}
💎 Total Wagered: ${formatBalance(stats.totalCoinsWagered || 0)} coins`;

    ctx.editMessageText(statsMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
        }
    });
});

// Leaderboard
bot.action('leaderboard', (ctx) => {
    const users = Object.entries(data.users)
        .filter(([_, user]) => user.wins + user.losses > 0)
        .sort(([_, a], [__, b]) => (b.wins - b.losses) - (a.wins - a.losses))
        .slice(0, 10);
    
    if (users.length === 0) {
        return ctx.editMessageText(
            '🏆 *Leaderboard*\n\nNo players on leaderboard yet! Be the first to play!',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
                }
            }
        );
    }
    
    let leaderboardText = '🏆 *Top Players*\n\n';
    users.forEach(([userId, user], index) => {
        const netWins = user.wins - user.losses;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        leaderboardText += `${medal} +${netWins} (${user.wins}W/${user.losses}L)\n`;
    });
    
    ctx.editMessageText(leaderboardText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'main_menu' }]]
        }
    });
});

// Multiplayer menu
bot.action('multiplayer_menu', (ctx) => {
    ctx.editMessageText(
        `🕹️ *Multiplayer Battle*\n\n*Choose multiplayer mode:*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎮 Create Room', callback_data: 'create_room' }],
                    [{ text: '🔗 Join Room', callback_data: 'join_room' }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }]
                ]
            }
        }
    );
});

// Main menu navigation
bot.action('main_menu', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    ctx.editMessageText(
        `🎮 *Gear Wars - Battle Arena*\n\n*Your Stats:*\n💰 Balance: *${formatBalance(user.balance)} coins*\n📊 Record: *${user.wins}W - ${user.losses}L*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚔️ Quick Battle (VS AI)', web_app: { url: 'https://gear-wars.vercel.app/' } }],
                    [{ text: '🕹️ Multiplayer Battle', callback_data: 'multiplayer_menu' }],
                    [{ text: '💰 Create Bet', callback_data: 'create_bet' }, { text: '📊 Betting Lobby', callback_data: 'bet_lobby' }],
                    [{ text: '🎨 Change Color', callback_data: 'change_color' }, { text: '🎁 Daily Bonus', callback_data: 'daily_bonus' }],
                    [{ text: '📈 Statistics', callback_data: 'stats' }, { text: '🏆 Leaderboard', callback_data: 'leaderboard' }]
                ]
            }
        }
    );
});

// Handle game results from web app
bot.on('web_app_data', (ctx) => {
    try {
        const result = JSON.parse(ctx.webAppData.data.json());
        const userId = ctx.from.id;
        const user = ensureUser(userId);
        
        if (result.type === 'game_result') {
            data.statistics.totalGames = (data.statistics.totalGames || 0) + 1;
            
            if (result.winner === 'player') {
                user.wins++;
                const coinsWon = 50;
                user.balance += coinsWon;
                user.totalEarnings = (user.totalEarnings || 0) + coinsWon;
                
                ctx.reply(
                    `🎉 *Victory!*\n\n` +
                    `💰 Won: *+${coinsWon} coins*\n` +
                    `📊 Record: *${user.wins}W - ${user.losses}L*\n` +
                    `🎯 Win Rate: *${getWinRate(user)}%*`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                user.losses++;
                ctx.reply(
                    `💔 *Defeat!*\n\n` +
                    `📊 Record: *${user.wins}W - ${user.losses}L*\n` +
                    `🎯 Win Rate: *${getWinRate(user)}%*\n\n` +
                    `*Better luck next time!*`,
                    { parse_mode: 'Markdown' }
                );
            }
            saveData();
        }
    } catch (error) {
        console.error('Error processing web app data:', error);
    }
});

// Handle bet game results
function processBetGameResult(gameId, winnerId) {
    const game = data.games.find(g => g.id === gameId);
    if (!game) return;
    
    const bet = data.bets.find(b => b.id === game.betId);
    if (!bet) return;
    
    const winner = data.users[winnerId];
    const loser = data.users[winnerId === game.player1 ? game.player2 : game.player1];
    
    if (!winner || !loser) return;
    
    const totalPot = game.betAmount * 2;
    const winnerPrize = Math.floor(totalPot * 0.95); // 5% house edge
    const houseFee = totalPot - winnerPrize;
    
    // Award winner
    winner.balance += winnerPrize;
    winner.wins++;
    winner.totalEarnings = (winner.totalEarnings || 0) + winnerPrize;
    
    // Update loser
    loser.losses++;
    
    // Update bet status
    bet.status = 'completed';
    bet.winner = winnerId;
    bet.completedAt = new Date();
    
    // Update game status
    game.status = 'completed';
    game.winner = winnerId;
    game.completedAt = new Date();
    
    // Update statistics
    data.statistics.totalGames = (data.statistics.totalGames || 0) + 1;
    
    saveData();
    
    // Notify players
    try {
        bot.telegram.sendMessage(
            winnerId,
            `🏆 *Bet Won!*\n\n` +
            `💰 Prize: *${formatBalance(winnerPrize)} coins*\n` +
            `📊 New Balance: *${formatBalance(winner.balance)} coins*\n` +
            `🎯 New Record: *${winner.wins}W - ${winner.losses}L*`,
            { parse_mode: 'Markdown' }
        );
        
        bot.telegram.sendMessage(
            loser.id,
            `💔 *Bet Lost*\n\n` +
            `📊 Record: *${loser.wins}W - ${loser.losses}L*\n` +
            `💰 Balance: *${formatBalance(loser.balance)} coins*\n\n` +
            `*Better luck next time!*`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error sending bet result notifications:', error);
    }
}

// Help command
bot.command('help', (ctx) => {
    ctx.reply(
        `🎮 *Gear Wars - Commands Guide*\n\n` +
        `*/start* - Main menu with all options\n` +
        `*/help* - This help message\n` +
        `*/stats* - Your personal statistics\n` +
        `*/leaderboard* - Top players ranking\n\n` +
        `*Game Modes:*\n` +
        `• *Quick Battle* - Practice against AI\n` +
        `• *Multiplayer* - Real PvP battles\n` +
        `• *Betting* - Wager coins on matches\n\n` +
        `*Features:*\n` +
        `• Daily bonus coins\n` +
        `• Customizable colors\n` +
        `• Win/loss tracking\n` +
        `• Achievement system\n\n` +
        `*Need help?* Contact support!`,
        { parse_mode: 'Markdown' }
    );
});

// ========================================
// SERVER SETUP
// ========================================

const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            bot: 'running',
            websocket: wsManager.getStats(),
            timestamp: Date.now()
        }));
    } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            users: Object.keys(data.users).length,
            activeBets: data.bets.filter(b => b.status === 'open').length,
            totalGames: data.statistics.totalGames || 0,
            websocket: wsManager.getStats()
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
    wsManager.wss.handleUpgrade(request, socket, head, (ws) => {
        wsManager.wss.emit('connection', ws, request);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🤖 Starting Telegram bot...`);
    
    // Start bot
    bot.launch()
        .then(() => {
            console.log('✅ Telegram bot started successfully!');
            console.log('🎮 Gear Wars is now LIVE!');
        })
        .catch(err => {
            console.error('❌ Failed to start bot:', err);
            process.exit(1);
        });
});

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stop('SIGINT');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.once('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stop('SIGTERM');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = { bot, processBetGameResult };
