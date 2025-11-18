// Main game logic - use the advanced version from your index.pdf
// This is a cleaned up version of the full game system
const GAME_CONFIG = {
    duration: 300,
    playerRadius: 20,
    gearRadius: 15,
    heartRadius: 12,
    boostForce: 8,
    moveForce: 0.6,
    friction: 0.98,
    wallBounce: 0.7,
    gearDuration: 5000,
    gearSpawnInterval: 8000,
    heartSpawnInterval: 15000,
    parryWindow: 300,
    shieldDuration: 2000,
    boostCooldown: 3000,
    staminaRegen: 0.3,
    heatDecay: 0.15,
    cornerBoostZone: 80
};

// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'menu'; // menu, playing, gameover
        this.players = [];
        this.gears = [];
        this.hearts = [];
        this.particles = [];
        this.keys = {};
        this.gameTime = GAME_CONFIG.duration;
        this.lastTime = Date.now();
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Get URL params for multiplayer
        const params = new URLSearchParams(window.location.search);
        this.gameId = params.get('game');
        this.playerNum = params.get('player');
        
        this.init();
    }

    resizeCanvas() {
        const aspect = 800 / 600;
        const maxWidth = window.innerWidth - 40;
        const maxHeight = window.innerWidth < 600 ? window.innerHeight - 350 : window.innerHeight - 200;
        let width = Math.min(800, maxWidth);
        let height = width / aspect;
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspect;
        }
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
    }

    init() {
        // Setup controls
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        this.setupMobileControls();
        
        // Screen buttons
        document.getElementById('startBtn').addEventListener('click', () => this.startSinglePlayer());
        document.getElementById('restartBtn').addEventListener('click', () => this.startSinglePlayer());
        document.getElementById('menuBtn').addEventListener('click', () => this.showMenu());
        
        this.gameLoop();
    }

    setupMobileControls() {
        // ... mobile touch controls from your index.pdf
        // Implementation remains the same
    }

    handleKeyDown(e) {
        if (this.state !== 'playing') return;
        this.keys[e.key] = true;
        
        // Player 1 abilities
        if (e.key === ' ') {
            e.preventDefault();
            this.players[0]?.boost();
        }
        if (e.key === 'Shift') this.players[0]?.activateShield();
        if (e.key === 'q') this.players[0]?.activateParry();
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }

    startSinglePlayer() {
        console.log('🎯 Starting single player game');
        this.state = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        
        // Reset game state
        this.gameTime = GAME_CONFIG.duration;
        this.gears = [];
        this.hearts = [];
        this.particles = [];
        
        // Create players
        this.players = [
            new Player(this.canvas.width / 4, this.canvas.height / 2, '#00ff88', {
                up: 'w', down: 's', left: 'a', right: 'd',
                boost: ' ', shield: 'Shift', parry: 'q'
            }),
            new Player(this.canvas.width * 3 / 4, this.canvas.height / 2, '#ff0088', {
                up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight'
            }, true) // AI player
        ];
        
        this.lastTime = Date.now();
    }

    endGame(winner) {
        this.state = 'gameover';
        const resultTitle = document.getElementById('resultTitle');
        const resultMessage = document.getElementById('resultMessage');
        
        let resultType = 'draw';
        if (winner === 0) {
            resultTitle.textContent = 'VICTORY! 🏆';
            resultMessage.textContent = 'You defeated the enemy!';
            resultType = 'player';
        } else if (winner === 1) {
            resultTitle.textContent = 'DEFEAT! 💀';
            resultMessage.textContent = 'The enemy was too strong!';
            resultType = 'ai';
        } else {
            resultTitle.textContent = 'DRAW! 🤝';
            resultMessage.textContent = 'Time ran out!';
        }
        
        document.getElementById('gameOverScreen').classList.remove('hidden');
        
        // Send result to bot
        this.sendGameResult(resultType);
    }

    sendGameResult(result) {
        try {
            const resultData = {
                type: 'game_result',
                winner: result,
                gameType: 'quick_battle',
                timestamp: Date.now()
            };
            
            // For WebApp
            tg.sendData(JSON.stringify(resultData));
            
            // For direct API (if available)
            if (window.parent !== window) {
                window.parent.postMessage(resultData, '*');
            }
            
            console.log('📤 Sent game result:', resultData);
        } catch (error) {
            console.log('❌ Could not send result:', error);
        }
    }

    update(dt) {
        if (this.state !== 'playing') return;
        
        // Update timers
        this.gameTime -= dt / 1000;
        if (this.gameTime <= 0) {
            this.endGame(this.players[0].health > this.players[1].health ? 0 : 
                       this.players[1].health > this.players[0].health ? 1 : -1);
            return;
        }
        
        // Update players
        this.players.forEach((player, index) => {
            const opponent = this.players[1 - index];
            player.update(dt, opponent, this.gears, this.hearts, this.keys);
        });
        
        // Collision detection
        this.checkCollisions();
        
        // Spawn items
        this.spawnItems(dt);
        
        // Update particles
        this.updateParticles(dt);
        
        // Update UI
        this.updateUI();
    }

    checkCollisions() {
        const [p1, p2] = this.players;
        if (!p1 || !p2) return;
        
        // Player collision
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < GAME_CONFIG.playerRadius * 2) {
            // Handle collision
            this.handlePlayerCollision(p1, p2, dx, dy, distance);
        }
        
        // Item collisions
        this.gears = this.gears.filter(gear => {
            if (gear.warning) return true;
            
            if (this.checkItemCollision(p1, gear, GAME_CONFIG.gearRadius)) {
                p1.hasGear = true;
                p1.gearTimer = GAME_CONFIG.gearDuration;
                return false;
            }
            if (this.checkItemCollision(p2, gear, GAME_CONFIG.gearRadius)) {
                p2.hasGear = true;
                p2.gearTimer = GAME_CONFIG.gearDuration;
                return false;
            }
            return true;
        });
        
        this.hearts = this.hearts.filter(heart => {
            if (this.checkItemCollision(p1, heart, GAME_CONFIG.heartRadius)) {
                p1.health = Math.min(5, p1.health + 1);
                return false;
            }
            if (this.checkItemCollision(p2, heart, GAME_CONFIG.heartRadius)) {
                p2.health = Math.min(5, p2.health + 1);
                return false;
            }
            return true;
        });
    }

    checkItemCollision(player, item, itemRadius) {
        const dx = player.x - item.x;
        const dy = player.y - item.y;
        return Math.sqrt(dx * dx + dy * dy) < GAME_CONFIG.playerRadius + itemRadius;
    }

    handlePlayerCollision(p1, p2, dx, dy, distance) {
        // Separate players
        const overlap = GAME_CONFIG.playerRadius * 2 - distance;
        const separateX = (dx / distance) * overlap / 2;
        const separateY = (dy / distance) * overlap / 2;
        
        p1.x -= separateX;
        p1.y -= separateY;
        p2.x += separateX;
        p2.y += separateY;
        
        // Bounce
        const tempVx = p1.vx;
        const tempVy = p1.vy;
        p1.vx = p2.vx * 0.5;
        p1.vy = p2.vy * 0.5;
        p2.vx = tempVx * 0.5;
        p2.vy = tempVy * 0.5;
        
        // Parry system
        this.handleParry(p1, p2);
        
        // Gear damage
        this.handleGearDamage(p1, p2);
    }

    handleParry(attacker, defender) {
        if (attacker.parrying && defender.hasGear) {
            attacker.hasGear = true;
            attacker.gearTimer = GAME_CONFIG.gearDuration;
            defender.hasGear = false;
            defender.gearTimer = 0;
            attacker.parrying = false;
            defender.invulnerable = true;
            defender.invulnerableTimer = 1000;
        }
    }

    handleGearDamage(attacker, defender) {
        if (attacker.hasGear && !defender.hasGear && !defender.shielded) {
            const damage = defender.heat >= 100 ? 2 : 1;
            if (defender.takeDamage(damage)) {
                attacker.heat = Math.min(100, attacker.heat + 20);
                if (attacker.heat >= 100) attacker.heat = 0;
            }
        }
    }

    spawnItems(dt) {
        // Spawn gears
        if (Math.random() < 0.008 && this.gears.length < 2) {
            this.gears.push(new Gear(
                Math.random() * (this.canvas.width - 100) + 50,
                Math.random() * (this.canvas.height - 100) + 50
            ));
        }
        
        // Spawn hearts
        if (Math.random() < 0.005 && this.hearts.length < 1) {
            this.hearts.push(new Heart(
                Math.random() * (this.canvas.width - 100) + 50,
                Math.random() * (this.canvas.height - 100) + 50
            ));
        }
    }

    updateParticles(dt) {
        this.particles = this.particles.filter(p => {
            p.update(dt);
            return p.life > 0;
        });
    }

    updateUI() {
        // Update timer
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = Math.floor(this.gameTime % 60);
        document.getElementById('gameTimer').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update player info
        this.players.forEach((player, i) => {
            const prefix = i === 0 ? 'p1' : 'p2';
            document.getElementById(`${prefix}Hearts`).innerHTML = '❤️'.repeat(player.health);
            document.getElementById(`${prefix}Stamina`).style.width = player.stamina + '%';
            document.getElementById(`${prefix}Heat`).style.width = player.heat + '%';
            
            // Shield status
            const shieldText = player.shielded ? 'ACTIVE' : 
                             player.shieldCharges === 0 ? 'NONE' :
                             player.stamina < 50 ? `${player.shieldCharges} (Need 50)` :
                             `${player.shieldCharges} Ready`;
            document.getElementById(`${prefix}Shield`).textContent = `Shield: ${shieldText}`;
            
            // Boost status
            const boostText = player.boostCooldown > 0 ? 
                            `${(player.boostCooldown / 1000).toFixed(1)}s` :
                            player.stamina < 40 ? 'Need 40 stamina' : 'Ready';
            document.getElementById(`${prefix}Boost`).textContent = `Boost: ${boostText}`;
        });
    }

    draw() {
        if (this.state !== 'playing') return;
        
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw corner boost zones
        this.drawCornerZones();
        
        // Draw items
        this.gears.forEach(gear => gear.draw(ctx));
        this.hearts.forEach(heart => heart.draw(ctx));
        
        // Draw particles
        this.particles.forEach(p => p.draw(ctx));
        
        // Draw players
        this.players.forEach(p => p.draw(ctx));
    }

    drawCornerZones() {
        const ctx = this.ctx;
        const zone = GAME_CONFIG.cornerBoostZone;
        ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
        [[0,0], [this.canvas.width-zone,0], [0,this.canvas.height-zone], [this.canvas.width-zone,this.canvas.height-zone]]
            .forEach(([x,y]) => ctx.fillRect(x, y, zone, zone));
    }

    gameLoop() {
        const currentTime = Date.now();
        const dt = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.update(dt);
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }

    showMenu() {
        this.state = 'menu';
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
    }
}

// Player class
class Player {
    constructor(x, y, color, controls, isAI = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.controls = controls;
        this.isAI = isAI;
        this.health = 5;
        this.stamina = 100;
        this.heat = 0;
        this.hasGear = false;
        this.gearTimer = 0;
        this.shielded = false;
        this.shieldCharges = 2;
        this.shieldTimer = 0;
        this.parrying = false;
        this.parryTimer = 0;
        this.boostCooldown = 0;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
        this.originalSpeed = 5;
    }

    update(dt, opponent, gears, hearts, keys) {
        // AI or player movement
        if (this.isAI) {
            this.updateAI(opponent, gears, hearts);
        } else {
            this.updatePlayer(keys);
        }
        
        // Update timers
        this.gearTimer = Math.max(0, this.gearTimer - dt);
        this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        this.parryTimer = Math.max(0, this.parryTimer - dt);
        this.boostCooldown = Math.max(0, this.boostCooldown - dt);
        this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
        
        if (this.gearTimer === 0) this.hasGear = false;
        if (this.shieldTimer === 0) this.shielded = false;
        if (this.parryTimer === 0) this.parrying = false;
        if (this.invulnerableTimer === 0) this.invulnerable = false;
        
        // Regen stamina
        this.stamina = Math.min(100, this.stamina + GAME_CONFIG.staminaRegen);
        
        // Decay heat
        this.heat = Math.max(0, this.heat - GAME_CONFIG.heatDecay);
        
        // Apply physics
        this.applyPhysics();
    }

    updatePlayer(keys) {
        if (keys[this.controls.up]) this.vy -= GAME_CONFIG.moveForce;
        if (keys[this.controls.down]) this.vy += GAME_CONFIG.moveForce;
        if (keys[this.controls.left]) this.vx -= GAME_CONFIG.moveForce;
        if (keys[this.controls.right]) this.vx += GAME_CONFIG.moveForce;
    }

    updateAI(opponent, gears, hearts) {
        // Simple AI logic
        let target = opponent;
        
        // Find nearest gear if we don't have one
        if (!this.hasGear) {
            const nearestGear = gears.find(g => !g.warning);
            if (nearestGear && this.distanceTo(nearestGear) < 200) {
                target = nearestGear;
            }
        }
        
        // Move toward target
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 50) {
            this.vx += (dx / dist) * GAME_CONFIG.moveForce;
            this.vy += (dy / dist) * GAME_CONFIG.moveForce;
        }
        
        // Random abilities
        if (Math.random() < 0.01 && this.stamina >= 40 && this.boostCooldown === 0) {
            this.boost();
        }
    }

    distanceTo(obj) {
        const dx = this.x - obj.x;
        const dy = this.y - obj.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    applyPhysics() {
        // Apply friction
        this.vx *= GAME_CONFIG.friction;
        this.vy *= GAME_CONFIG.friction;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Wall collision
        const radius = GAME_CONFIG.playerRadius;
        const canvas = document.getElementById('gameCanvas');
        
        if (this.x - radius < 0) { this.x = radius; this.vx *= -GAME_CONFIG.wallBounce; }
        if (this.x + radius > canvas.width) { this.x = canvas.width - radius; this.vx *= -GAME_CONFIG.wallBounce; }
        if (this.y - radius < 0) { this.y = radius; this.vy *= -GAME_CONFIG.wallBounce; }
        if (this.y + radius > canvas.height) { this.y = canvas.height - radius; this.vy *= -GAME_CONFIG.wallBounce; }
        
        // Corner boost
        const inCorner = (this.x < GAME_CONFIG.cornerBoostZone && this.y < GAME_CONFIG.cornerBoostZone) ||
                        (this.x > canvas.width - GAME_CONFIG.cornerBoostZone && this.y < GAME_CONFIG.cornerBoostZone) ||
                        (this.x < GAME_CONFIG.cornerBoostZone && this.y > canvas.height - GAME_CONFIG.cornerBoostZone) ||
                        (this.x > canvas.width - GAME_CONFIG.cornerBoostZone && this.y > canvas.height - GAME_CONFIG.cornerBoostZone);
        if (inCorner) {
            this.vx *= 1.02;
            this.vy *= 1.02;
        }
    }

    boost() {
        if (this.stamina >= 40 && this.boostCooldown === 0) {
            const angle = Math.atan2(this.vy, this.vx) || 0;
            this.vx += Math.cos(angle) * GAME_CONFIG.boostForce;
            this.vy += Math.sin(angle) * GAME_CONFIG.boostForce;
            this.stamina -= 40;
            this.boostCooldown = GAME_CONFIG.boostCooldown;
            this.createParticles(this.x, this.y, '#00d4ff', 15);
        }
    }

    activateShield() {
        if (this.stamina >= 50 && this.shieldCharges > 0 && !this.shielded) {
            this.shielded = true;
            this.shieldTimer = GAME_CONFIG.shieldDuration;
            this.shieldCharges--;
            this.stamina -= 50;
            this.createParticles(this.x, this.y, '#00ff88', 20);
        }
    }

    activateParry() {
        if (!this.parrying) {
            this.parrying = true;
            this.parryTimer = GAME_CONFIG.parryWindow;
            this.createParticles(this.x, this.y, '#ffff00', 10);
        }
    }

    takeDamage(amount) {
        if (!this.shielded && !this.invulnerable) {
            this.health -= amount;
            this.invulnerable = true;
            this.invulnerableTimer = 500;
            this.createParticles(this.x, this.y, '#ff0000', 12);
            return true;
        } else if (this.shielded) {
            this.shielded = false;
            this.shieldTimer = 0;
        }
        return false;
    }

    createParticles(x, y, color, count = 8) {
        // Create particle effect
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            window.game.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30,
                maxLife: 30,
                color,
                size: Math.random() * 3 + 1
            });
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Player circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, GAME_CONFIG.playerRadius, 0, Math.PI * 2);
        
        if (this.invulnerable && Math.floor(Date.now() / 100) % 2) {
            ctx.globalAlpha = 0.5;
        }
        
        // Gear effect
        if (this.hasGear) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Date.now() / 200);
            ctx.fillStyle = '#ff6600';
            const teeth = 8;
            ctx.beginPath();
            for (let i = 0; i < teeth; i++) {
                const angle = (i / teeth) * Math.PI * 2;
                const nextAngle = ((i + 1) / teeth) * Math.PI * 2;
                ctx.lineTo(Math.cos(angle) * GAME_CONFIG.playerRadius, Math.sin(angle) * GAME_CONFIG.playerRadius);
                ctx.lineTo(Math.cos((angle + nextAngle) / 2) * GAME_CONFIG.playerRadius * 0.6, 
                          Math.sin((angle + nextAngle) / 2) * GAME_CONFIG.playerRadius * 0.6);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        
        // Shield effect
        if (this.shielded) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, GAME_CONFIG.playerRadius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Parry indicator
        if (this.parrying) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, GAME_CONFIG.playerRadius + 12, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Heat meter
        if (this.heat >= 100) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0000';
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, GAME_CONFIG.playerRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Health
        ctx.fillStyle = '#e74c3c';
        for (let i = 0; i < this.health; i++) {
            ctx.beginPath();
            ctx.arc(this.x - GAME_CONFIG.playerRadius + i * 12, this.y - GAME_CONFIG.playerRadius - 15, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Gear class
class Gear {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = GAME_CONFIG.gearRadius;
        this.warning = true;
        this.warningTimer = 2000;
    }

    update(dt) {
        this.warningTimer = Math.max(0, this.warningTimer - dt);
        if (this.warningTimer === 0) this.warning = false;
    }

    draw(ctx) {
        if (this.warning) {
            // Warning pulse
            const alpha = Math.sin(Date.now() / 100) * 0.3 + 0.7;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.font = '12px monospace';
            ctx.fillStyle = '#ffff00';
            ctx.textAlign = 'center';
            ctx.fillText('GEAR', this.x, this.y - 50);
            ctx.fillText((this.warningTimer / 1000).toFixed(1) + 's', this.x, this.y + 60);
            ctx.restore();
        } else {
            // Actual gear
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(Date.now() / 200);
            ctx.fillStyle = '#ff6600';
            
            const teeth = 8;
            ctx.beginPath();
            for (let i = 0; i < teeth; i++) {
                const angle = (i / teeth) * Math.PI * 2;
                const nextAngle = ((i + 1) / teeth) * Math.PI * 2;
                const outerRadius = this.radius;
                const innerRadius = this.radius * 0.6;
                
                ctx.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
                ctx.lineTo(Math.cos((angle + nextAngle) / 2) * innerRadius, 
                          Math.sin((angle + nextAngle) / 2) * innerRadius);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

// Heart class
class Heart {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = GAME_CONFIG.heartRadius;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(1, 1 + Math.sin(Date.now() / 200) * 0.1);
        ctx.fillStyle = '#ff0088';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❤️', 0, 0);
        ctx.restore();
    }
}

// Initialize game when page loads
window.game = new Game();
