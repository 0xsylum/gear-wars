const http = require('http');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const WebSocketManager = require('./websocket');
const { P3DGameManager } = require('./p3d-integration');
const { TournamentManager } = require('./tournaments');

// Initialize managers
const bot = new Telegraf(process.env.BOT_TOKEN);
const wsManager = new WebSocketManager();
const p3dManager = new P3DGameManager();
const tournamentManager = new TournamentManager();

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Data storage
const DATA_PATH = path.join(DATA_DIR, 'data.json');
let data = {
    users: {},
    orders: [],
    games: [],
    bets: [],
    leaderboard: {},
    statistics: { totalGames: 0, totalBets: 0, totalCoinsWagered: 0 },
    achievements: { globalUnlocks: {}, rarityDistribution: {} },
    tournaments: { active: [], completed: [], totalPrizePool: 0 }
};

// Load data
function loadData() {
    try {
        if (fs.existsSync(DATA_PATH)) {
            const saved = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
            data = { ...data, ...saved };
            console.log('✅ Data loaded');
        }
    } catch (error) {
        console.warn('⚠️ Starting fresh data file');
    }
}

// Save data
function saveData() {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Failed to save data:', error);
    }
}

// Initialize P3D (simulation mode)
p3dManager.initialize().then(() => {
    console.log('🎮 P3D simulation initialized');
});

// Helper functions
function ensureUser(userId, username = '') {
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 1000,
            wins: 0,
            losses: 0,
            color: '#3498db',
            lastDailyBonus: null,
            joinedAt: new Date().toISOString(),
            totalEarnings: 0,
            achievements: [],
            p3dBalance: 0,
            referralCode: null
        };
        saveData();
    }
    return data.users[userId];
}

function formatBalance(balance) {
    return balance.toLocaleString();
}

function getWinRate(user) {
    const total = user.wins + user.losses;
    return total > 0 ? ((user.wins / total) * 100).toFixed(1) : 0;
}

// ========================================
// BOT COMMANDS
// ========================================

// Start command
bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId, ctx.from.username);
    
    const message = `🎮 *Gear Wars - Battle Arena*

*Your Stats:*
💰 Balance: *${formatBalance(user.balance)} coins*
📊 Record: *${user.wins}W - ${user.losses}L*
🎯 Win Rate: *${getWinRate(user)}%*
🎨 Color: ${user.color}

*🌟 Beta Features:*
• P3D Rewards (Simulation Mode)
• Real-time Multiplayer
• Betting System
• Tournaments
• Achievements

*Choose an action:*`;

    ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.webApp('⚔️ Quick Battle (VS AI)', 'https://gear-wars.vercel.app/')],
            [Markup.button.callback('🕹️ Multiplayer Battle', 'multiplayer_menu')],
            [Markup.button.callback('💰 Create Bet', 'create_bet'), Markup.button.callback('📊 Betting Lobby', 'bet_lobby')],
            [Markup.button.callback('🏆 Tournaments', 'tournament_menu')],
            [Markup.button.callback('🎨 Change Color', 'change_color'), Markup.button.callback('🎁 Daily Bonus', 'daily_bonus')],
            [Markup.button.callback('📈 Statistics', 'stats'), Markup.button.callback('🎖️ Leaderboard', 'leaderboard')],
            [Markup.button.callback('💎 P3D Dashboard', 'p3d_dashboard')]
        ])
    });
});

// P3D Commands
bot.command('p3d', async (ctx) => {
    const userId = ctx.from.id;
    const dashboard = await p3dManager.getUserDashboard(userId);
    
    // Update user data
    const user = ensureUser(userId);
    user.p3dBalance = dashboard.balance;
    
    const message = `🎮 *3DPass Network - Gear Wars Integration*
*🔧 SIMULATION MODE*

💰 *Your P3D Balance:* ${dashboard.balance.toFixed(6)} P3D
🏆 *Leaderboard Position:* ${dashboard.leaderboardPosition || 'Not ranked'}
📈 *Staking Rewards:* ${dashboard.stakingRewards.toFixed(6)} P3D
👥 *Referral Code:* \`${dashboard.referralCode}\`

*Earn P3D by:*
• 🎯 Winning battles
• 💰 Placing bets  
• 🏆 Tournament victories
• 👥 Referring friends

*Note: Running in simulation mode. P3D balances are tracked locally.*
*Use /p3d_stake to stake your P3D tokens!*`;

    ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('p3d_stake', (ctx) => {
    ctx.reply(
        '💰 *3DPass Staking*\n\nStake your P3D tokens to earn 15% APR rewards!\n\n' +
        'Available staking amounts:\n' +
        '• 10 P3D\n• 50 P3D  \n• 100 P3D\n• 500 P3D\n\n' +
        'Use: `/stake_amount 50` to stake 50 P3D',
        { parse_mode: 'Markdown' }
    );
});

bot.command('p3d_leaderboard', async (ctx) => {
    const leaderboard = await p3dManager.p3d.getP3DLeaderboard();
    
    let text = '🏆 *3DPass Leaderboard*\n\n';
    leaderboard.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        text += `${medal} ${entry.balance.toFixed(6)} P3D\n`;
    });
    
    ctx.reply(text, { parse_mode: 'Markdown' });
});

// Tournament commands
bot.command('tournament_create', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    if (user.balance < 100) {
        return ctx.reply('❌ Need at least 100 coins to create a tournament');
    }
    
    const tournament = tournamentManager.createTournament(userId, {
        name: `${ctx.from.username || 'User'}'s Tournament`,
        entryFee: 50,
        maxPlayers: 8
    });
    
    user.balance -= 100;
    saveData();
    
    ctx.reply(`🏆 Tournament Created!\n\nID: \`${tournament.id}\`\nEntry: 50 coins\nPlayers: 0/8\n\nShare this ID with friends!`);
});

bot.command('tournament_join', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const tournamentId = args[0];
    
    if (!tournamentId) {
        return ctx.reply('❌ Usage: /tournament_join <tournament_id>');
    }
    
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    const result = tournamentManager.joinTournament(tournamentId, userId, {
        username: ctx.from.username,
        balance: user.balance
    });
    
    if (result.success) {
        ctx.reply(`✅ Joined tournament!\n\n${result.playersRemaining} spots remaining`);
    } else {
        ctx.reply(`❌ ${result.error}`);
    }
});

// Betting system
bot.action('create_bet', (ctx) => {
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    const amounts = [10, 50, 100, 250, 500, 1000];
    const buttons = amounts.map(amount => 
        Markup.button.callback(
            user.balance >= amount ? `💰 ${amount} coins` : `${amount} ❌`,
            user.balance >= amount ? `create_bet_${amount}` : 'insufficient_funds'
        )
    );
    
    ctx.editMessageText('🎯 *Create a Bet*\n\nSelect your wager amount:', {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([...buttons, [Markup.button.callback('🔙 Back', 'main_menu')]])
    });
});

bot.action(/create_bet_(\d+)/, (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    const user = ensureUser(userId);
    
    if (user.balance < amount) {
        return ctx.answerCbQuery('❌ Insufficient balance!');
    }
    
    const betId = Date.now().toString();
    const bet = {
        id: betId,
        userId: userId,
        username: ctx.from.username || ctx.from.first_name,
        amount: amount,
        createdAt: new Date(),
        status: 'open',
        expiresAt: Date.now() + (30 * 60 * 1000)
    };
    
    data.bets.push(bet);
    user.balance -= amount;
    data.statistics.totalBets = (data.statistics.totalBets || 0) + 1;
    data.statistics.totalCoinsWagered = (data.statistics.totalCoinsWagered || 0) + amount;
    saveData();
    
    ctx.answerCbQuery('✅ Bet created!');
    ctx.editMessageText(
        `🎯 *Bet Created!*\n\n💰 Amount: *${formatBalance(amount)}*\n🆔 ID: \`${betId}\`\n⏰ Expires: 30 min\n\nShare this ID or wait in lobby!`,
        {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('📊 View Lobby', 'bet_lobby')],
                [Markup.button.callback('❌ Cancel Bet', `cancel_bet_${betId}`)],
                [Markup.button.callback('🔙 Main Menu', 'main_menu')]
            ])
        }
    );
});

// Game result handling
bot.on('web_app_data', async (ctx) => {
    try {
        const result = JSON.parse(ctx.webAppData.data.json());
        const userId = ctx.from.id;
        const user = ensureUser(userId);
        
        if (result.type === 'game_result') {
            // Process P3D rewards
            const p3dResult = await p3dManager.handleGameResult(userId, {
                won: result.winner === 'player',
                winStreak: result.winStreak || 0,
                gameType: result.gameType || 'quick_battle'
            });
            
            // Update stats
            data.statistics.totalGames = (data.statistics.totalGames || 0) + 1;
            
            let reply = '';
            if (result.winner === 'player') {
                user.wins++;
                user.balance += 50;
                user.totalEarnings = (user.totalEarnings || 0) + 50;
                reply = `🎉 Victory! +50 coins\n`;
            } else {
                user.losses++;
                reply = `💔 Defeat!\n`;
            }
            
            if (p3dResult.totalAwarded > 0) {
                reply += `💰 *P3D Rewards:* +${p3dResult.totalAwarded.toFixed(6)} P3D\n`;
            }
            
            reply += `\n📊 Record: ${user.wins}W - ${user.losses}L`;
            ctx.reply(reply, { parse_mode: 'Markdown' });
            saveData();
        }
    } catch (error) {
        console.error('Game result error:', error);
    }
});

// Other callback handlers... (simplified for brevity)
bot.action('main_menu', (ctx) => {
    const user = ensureUser(ctx.from.id);
    ctx.editMessageText(`🎮 *Gear Wars*\n\n💰 Balance: *${formatBalance(user.balance)}*`, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.webApp('⚔️ Quick Battle', 'https://gear-wars.vercel.app/')],
            [Markup.button.callback('🕹️ Multiplayer', 'multiplayer_menu')],
            [Markup.button.callback('💰 Create Bet', 'create_bet'), Markup.button.callback('📊 Lobby', 'bet_lobby')],
            [Markup.button.callback('🎨 Color', 'change_color'), Markup.button.callback('🎁 Daily Bonus', 'daily_bonus')],
            [Markup.button.callback('📈 Stats', 'stats'), Markup.button.callback('🏆 Leaderboard', 'leaderboard')]
        ])
    });
});

// ========================================
// SERVER SETUP
// ========================================

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Webhook endpoint
    if (req.url.startsWith('/webhook/') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                await bot.handleUpdate(JSON.parse(body));
                res.writeHead(200);
                res.end('OK');
            } catch (error) {
                console.error('Webhook error:', error);
                res.writeHead(500);
                res.end('Error');
            }
        });
        return;
    }

    // Health check
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
            totalGames: data.statistics.totalGames,
            websocket: wsManager.getStats()
        }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// WebSocket upgrade handling
server.on('upgrade', (request, socket, head) => {
    wsManager.wss.handleUpgrade(request, socket, head, (ws) => {
        wsManager.wss.emit('connection', ws, request);
    });
});

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Shutting down...');
    bot.stop('SIGINT');
    server.close(() => process.exit(0));
});

process.once('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    bot.stop('SIGTERM');
    server.close(() => process.exit(0));
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    loadData();
    
    // Set webhook for production
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_DOMAIN) {
        const webhookUrl = `${process.env.WEBHOOK_DOMAIN}/webhook/${process.env.BOT_TOKEN}`;
        try {
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`✅ Webhook set: ${webhookUrl}`);
        } catch (err) {
            console.error('❌ Webhook setup failed:', err);
        }
    } else {
        // Development mode - polling
        bot.launch();
        console.log('🔄 Bot running in polling mode');
    }
    
    console.log('🎮 Gear Wars Beta is LIVE!');
});

module.exports = { bot, data, saveData, ensureUser };
