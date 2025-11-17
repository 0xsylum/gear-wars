// Telegram Web App initialization
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');

// Set canvas size
function resizeCanvas() {
    const size = Math.min(600, window.innerWidth, window.innerHeight - 100);
    canvas.width = size;
    canvas.height = size;
}
resizeCanvas();

// Game state
const state = {
    players: [
        { x: 100, y: 300, radius: 25, color: '#3498db', health: 5, gear: false, gearTime: 0, vx: 0, vy: 0 },
        { x: 500, y: 300, radius: 25, color: '#e74c3c', health: 5, gear: false, gearTime: 0, vx: 0, vy: 0 }
    ],
    powerUps: [],
    gameTime: 60,
    gameStart: 0,
    isGameOver: false,
    winner: null,
    shakeFrames: 0,
    particles: [],
    gameRunning: false
};

// Controls
const keys = { up: false, down: false, left: false, right: false };

// Keyboard events
window.addEventListener('keydown', (e) => {
    if (!state.gameRunning) return;
    
    if (e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'ArrowDown') keys.down = true;
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
});

// Mobile touch controls
function setupMobileControls() {
    const controls = ['up', 'down', 'left', 'right'];
    controls.forEach(dir => {
        const btn = document.getElementById(dir);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (state.gameRunning) keys[dir] = true;
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[dir] = false;
        });
    });
}

// Touch movement (direct tap to move)
canvas.addEventListener('touchstart', (e) => {
    if (!state.gameRunning) return;
    
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const touchY = e.touches[0].clientY - rect.top;
    
    // Move toward touch point
    const player = state.players[0];
    const dx = touchX - player.x;
    const dy = touchY - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 10) {
        player.vx = (dx / distance) * 5;
        player.vy = (dy / distance) * 5;
    }
});

// Screen management
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Reset game state
    state.players[0] = { x: 100, y: canvas.height/2, radius: 25, color: '#3498db', health: 5, gear: false, gearTime: 0, vx: 0, vy: 0 };
    state.players[1] = { x: canvas.width-100, y: canvas.height/2, radius: 25, color: '#e74c3c', health: 5, gear: false, gearTime: 0, vx: 0, vy: 0 };
    state.powerUps = [];
    state.gameTime = 60;
    state.gameStart = Date.now();
    state.isGameOver = false;
    state.winner = null;
    state.shakeFrames = 0;
    state.particles = [];
    state.gameRunning = true;
    
    // Try to get user color from Telegram data
    try {
        const user = tg.initDataUnsafe.user;
        if (user && user.id) {
            // In real implementation, fetch user color from your backend
            // For now, use random color from palette
            const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
            state.players[0].color = colors[user.id % colors.length];
        }
    } catch (e) {
        console.log('Could not get Telegram user data');
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (!state.gameRunning || state.isGameOver) return;
    
    // Update game time
    const elapsed = (Date.now() - state.gameStart) / 1000;
    state.gameTime = Math.max(0, 60 - elapsed);
    
    if (state.gameTime <= 0) {
        endGame(state.players[0].health > state.players[1].health ? 0 : 
               state.players[1].health > state.players[0].health ? 1 : -1);
        return;
    }
    
    // Update player 1 (user) movement
    const player = state.players[0];
    player.vx = 0;
    player.vy = 0;
    
    if (keys.up) player.vy = -5;
    if (keys.down) player.vy = 5;
    if (keys.left) player.vx = -5;
    if (keys.right) player.vx = 5;
    
    // Normalize diagonal movement
    if (player.vx !== 0 && player.vy !== 0) {
        player.vx *= 0.707;
        player.vy *= 0.707;
    }
    
    // Update positions
    state.players.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        // Boundary collision (bounce)
        if (p.x - p.radius < 0) { p.x = p.radius; p.vx *= -1; }
        if (p.x + p.radius > canvas.width) { p.x = canvas.width - p.radius; p.vx *= -1; }
        if (p.y - p.radius < 0) { p.y = p.radius; p.vy *= -1; }
        if (p.y + p.radius > canvas.height) { p.y = canvas.height - p.radius; p.vy *= -1; }
        
        // Update gear timer
        if (p.gear) {
            p.gearTime -= 1/60;
            if (p.gearTime <= 0) {
                p.gear = false;
            }
        }
    });
    
    // Simple AI for player 2
    const ai = state.players[1];
    const player1 = state.players[0];
    
    // Move toward player or power-up
    let targetX = player1.x;
    let targetY = player1.y;
    
    // Find nearest power-up
    let nearestPowerUp = null;
    let minDistance = Infinity;
    
    state.powerUps.forEach(powerUp => {
        const dx = ai.x - powerUp.x;
        const dy = ai.y - powerUp.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance && (powerUp.type === 'gear' || ai.health < 3)) {
            minDistance = distance;
            nearestPowerUp = powerUp;
        }
    });
    
    if (nearestPowerUp && minDistance < 200) {
        targetX = nearestPowerUp.x;
        targetY = nearestPowerUp.y;
    }
    
    const dx = targetX - ai.x;
    const dy = targetY - ai.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 50) {
        ai.vx = (dx / distance) * 4;
        ai.vy = (dy / distance) * 4;
    } else {
        // Circle around player
        ai.vx = -dy / distance * 3;
        ai.vy = dx / distance * 3;
    }
    
    // Player collision
    const p1 = state.players[0];
    const p2 = state.players[1];
    const pdx = p1.x - p2.x;
    const pdy = p1.y - p2.y;
    const pDistance = Math.sqrt(pdx * pdx + pdy * pdy);
    
    if (pDistance < p1.radius + p2.radius) {
        // Collision occurred
        if (p1.gear && !p2.gear) {
            p2.health--;
            triggerShake();
            spawnParticles(p2.x, p2.y, '#e74c3c');
            if (p2.health <= 0) endGame(0);
        } else if (p2.gear && !p1.gear) {
            p1.health--;
            triggerShake();
            spawnParticles(p1.x, p1.y, '#e74c3c');
            if (p1.health <= 0) endGame(1);
        }
        
        // Bounce effect
        const angle = Math.atan2(pdy, pdx);
        const force = 3;
        p1.vx = Math.cos(angle) * force;
        p1.vy = Math.sin(angle) * force;
        p2.vx = -Math.cos(angle) * force;
        p2.vy = -Math.sin(angle) * force;
    }
    
    // Spawn power-ups
    if (Math.random() < 0.01 && state.powerUps.length < 3) {
        state.powerUps.push({
            x: Math.random() * (canvas.width - 30) + 15,
            y: Math.random() * (canvas.height - 30) + 15,
            type: Math.random() > 0.5 ? 'gear' : 'heart',
            radius: 15
        });
    }
    
    // Power-up collisions
    state.powerUps = state.powerUps.filter(powerUp => {
        let collected = false;
        state.players.forEach(player => {
            const dx = player.x - powerUp.x;
            const dy = player.y - powerUp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.radius + powerUp.radius) {
                collected = true;
                if (powerUp.type === 'gear') {
                    player.gear = true;
                    player.gearTime = 5;
                    spawnParticles(powerUp.x, powerUp.y, '#f1c40f');
                } else if (powerUp.type === 'heart') {
                    player.health = Math.min(5, player.health + 1);
                    spawnParticles(powerUp.x, powerUp.y, '#e74c3c');
                }
            }
        });
        return !collected;
    });
    
    // Update particles
    state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
    });
    
    // Update shake
    if (state.shakeFrames > 0) state.shakeFrames--;
    
    // Update UI
    document.getElementById('health').textContent = state.players[0].health;
    document.getElementById('time').textContent = Math.ceil(state.gameTime);
    document.getElementById('gear').textContent = state.players[0].gear ? 'YES' : 'NO';
    document.getElementById('gear').style.color = state.players[0].gear ? '#f1c40f' : '#95a5a6';
}

function draw() {
    // Clear with shake effect
    ctx.save();
    if (state.shakeFrames > 0) {
        ctx.translate(
            (Math.random() - 0.5) * state.shakeFrames,
            (Math.random() - 0.5) * state.shakeFrames
        );
    }
    
    // Background
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    
    // Draw power-ups
    state.powerUps.forEach(powerUp => {
        if (powerUp.type === 'gear') {
            // Draw gear
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Gear teeth
            ctx.fillStyle = '#e67e22';
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const tx = powerUp.x + Math.cos(angle) * powerUp.radius;
                const ty = powerUp.y + Math.sin(angle) * powerUp.radius;
                ctx.beginPath();
                ctx.arc(tx, ty, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Draw heart
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            const size = powerUp.radius;
            ctx.moveTo(powerUp.x, powerUp.y + size/3);
            ctx.bezierCurveTo(
                powerUp.x, powerUp.y,
                powerUp.x - size, powerUp.y,
                powerUp.x - size, powerUp.y + size/3
            );
            ctx.bezierCurveTo(
                powerUp.x - size, powerUp.y + size,
                powerUp.x, powerUp.y + size,
                powerUp.x, powerUp.y + size * 1.3
            );
            ctx.bezierCurveTo(
                powerUp.x, powerUp.y + size,
                powerUp.x + size, powerUp.y + size,
                powerUp.x + size, powerUp.y + size/3
            );
            ctx.bezierCurveTo(
                powerUp.x + size, powerUp.y,
                powerUp.x, powerUp.y,
                powerUp.x, powerUp.y + size/3
            );
            ctx.fill();
        }
    });
    
    // Draw players
    state.players.forEach((player, index) => {
        // Player circle
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Player border
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Gear effect
        if (player.gear) {
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Rotating teeth
            const time = Date.now() / 200;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + time;
                const tx = player.x + Math.cos(angle) * (player.radius + 12);
                const ty = player.y + Math.sin(angle) * (player.radius + 12);
                ctx.fillStyle = '#e67e22';
                ctx.beginPath();
                ctx.arc(tx, ty, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Health display
        ctx.fillStyle = '#e74c3c';
        for (let i = 0; i < player.health; i++) {
            ctx.beginPath();
            ctx.arc(
                player.x - player.radius + i * 12, 
                player.y - player.radius - 15, 
                3, 0, Math.PI * 2
            );
            ctx.fill();
        }
    });
    
    // Draw particles
    state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    ctx.restore();
}

function triggerShake() {
    state.shakeFrames = 10;
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        state.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 30,
            color
        });
    }
}

function endGame(winnerIndex) {
    state.isGameOver = true;
    state.gameRunning = false;
    state.winner = winnerIndex;
    
    setTimeout(() => {
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        
        if (winnerIndex === 0) {
            resultTitle.textContent = 'VICTORY! 🏆';
            resultMessage.textContent = 'You defeated the enemy!';
            // Send win to bot
            sendGameResult('player');
        } else if (winnerIndex === 1) {
            resultTitle.textContent = 'DEFEAT! 💀';
            resultMessage.textContent = 'The enemy was too strong!';
            sendGameResult('ai');
        } else {
            resultTitle.textContent = 'DRAW! 🤝';
            resultMessage.textContent = 'The battle was evenly matched!';
            sendGameResult('draw');
        }
        
        gameOverScreen.classList.remove('hidden');
    }, 1000);
}

function sendGameResult(result) {
    try {
        tg.sendData(JSON.stringify({
            type: 'game_result',
            winner: result,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.log('Could not send game result to bot');
    }
}

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Initialize the game
setupMobileControls();
gameLoop();
 // Add to game/game.js

const POWER_UPS = {
    shield: {
        name: 'Shield',
        color: '#3498db',
        duration: 4,
        effect: (player) => {
            player.shield = true;
            player.shieldTime = 4;
        }
    },
    speed: {
        name: 'Speed Boost',
        color: '#2ecc71', 
        duration: 6,
        effect: (player) => {
            player.speedBoost = true;
            player.speedTime = 6;
            player.originalSpeed = 5;
            player.speed = 8;
        }
    },
    multiGear: {
        name: 'Multi-Gear',
        color: '#e74c3c',
        duration: 8,
        effect: (player) => {
            player.multiGear = true;
            player.multiGearTime = 8;
        }
    }
};

// Enhanced power-up spawning
function spawnPowerUp() {
    if (Math.random() < 0.008 && state.powerUps.length < 4) {
        const types = ['gear', 'heart', 'shield', 'speed', 'multiGear'];
        const weights = [0.4, 0.3, 0.1, 0.1, 0.1]; // Probabilities
        
        let random = Math.random();
        let type = 'gear'; // default
        
        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                type = types[i];
                break;
            }
        }
        
        state.powerUps.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: Math.random() * (canvas.height - 40) + 20,
            type: type,
            radius: type === 'gear' ? 15 : 12
        });
    }
}

// Enhanced power-up collection
function collectPowerUp(player, powerUp) {
    switch (powerUp.type) {
        case 'gear':
            player.gear = true;
            player.gearTime = 5;
            break;
        case 'heart':
            player.health = Math.min(5, player.health + 1);
            break;
        case 'shield':
            player.shield = true;
            player.shieldTime = 4;
            break;
        case 'speed':
            player.speedBoost = true;
            player.speedTime = 6;
            player.originalSpeed = 5;
            player.speed = 8;
            break;
        case 'multiGear':
            player.multiGear = true;
            player.multiGearTime = 8;
            break;
    }
    spawnParticles(powerUp.x, powerUp.y, getPowerUpColor(powerUp.type));
} 
