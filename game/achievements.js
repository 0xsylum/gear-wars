class AchievementManager {
    constructor() {
        this.achievements = {
            first_win: {
                id: 'first_win',
                name: "First Blood",
                desc: "Win your first battle",
                icon: "🩸",
                unlocked: false,
                rarity: 'common',
                points: 10
            },
            gear_collector: {
                id: 'gear_collector', 
                name: "Gear Collector",
                desc: "Collect 50 gears total",
                icon: "⚙️",
                unlocked: false,
                rarity: 'uncommon',
                points: 25,
                progress: { current: 0, target: 50 }
            },
            comeback_king: {
                id: 'comeback_king',
                name: "Comeback King", 
                desc: "Win a battle with 1 HP remaining",
                icon: "👑",
                unlocked: false,
                rarity: 'rare',
                points: 50
            },
            speed_demon: {
                id: 'speed_demon',
                name: "Speed Demon",
                desc: "Win a battle in under 60 seconds",
                icon: "⚡",
                unlocked: false,
                rarity: 'rare', 
                points: 50
            },
            untouchable: {
                id: 'untouchable',
                name: "Untouchable",
                desc: "Win without taking any damage",
                icon: "🛡️",
                unlocked: false,
                rarity: 'epic',
                points: 100
            },
            perfect_parry: {
                id: 'perfect_parry',
                name: "Perfect Parry",
                desc: "Successfully parry 3 times in one game",
                icon: "🎯",
                unlocked: false,
                rarity: 'uncommon',
                points: 30
            },
            stamina_master: {
                id: 'stamina_master',
                name: "Stamina Master",
                desc: "Use 5 boosts in a single game",
                icon: "💨",
                unlocked: false, 
                rarity: 'uncommon',
                points: 30
            },
            heat_meister: {
                id: 'heat_meister',
                name: "Heat Meister",
                desc: "Activate heat burst 3 times in one game",
                icon: "🔥",
                unlocked: false,
                rarity: 'rare',
                points: 50
            },
            sharpshooter: {
                id: 'sharpshooter',
                name: "Sharpshooter",
                desc: "Land 5 consecutive gear hits",
                icon: "🎯",
                unlocked: false,
                rarity: 'epic',
                points: 75
            },
            marathon_runner: {
                id: 'marathon_runner',
                name: "Marathon Runner",
                desc: "Play 10 total games",
                icon: "🏃",
                unlocked: false,
                rarity: 'common',
                points: 20,
                progress: { current: 0, target: 10 }
            },
            rich_warrior: {
                id: 'rich_warrior',
                name: "Rich Warrior", 
                desc: "Reach 5,000 coins balance",
                icon: "💰",
                unlocked: false,
                rarity: 'uncommon',
                points: 40,
                progress: { current: 0, target: 5000 }
            },
            betting_pro: {
                id: 'betting_pro',
                name: "Betting Pro",
                desc: "Win 10 betting matches",
                icon: "🎲",
                unlocked: false,
                rarity: 'rare',
                points: 60,
                progress: { current: 0, target: 10 }
            },
            color_collector: {
                id: 'color_collector',
                name: "Color Collector",
                desc: "Unlock all player colors",
                icon: "🎨",
                unlocked: false,
                rarity: 'uncommon',
                points: 35
            },
            daily_champion: {
                id: 'daily_champion',
                name: "Daily Champion", 
                desc: "Claim daily bonus 7 days in a row",
                icon: "📅",
                unlocked: false,
                rarity: 'rare',
                points: 50,
                progress: { current: 0, target: 7 }
            },
            unstoppable: {
                id: 'unstoppable',
                name: "Unstoppable",
                desc: "Achieve a 5-win streak",
                icon: "💪",
                unlocked: false,
                rarity: 'epic',
                points: 100
            }
        };
        
        this.unlockedAchievements = [];
        this.totalPoints = 0;
        this.loadProgress();
    }
    
    loadProgress() {
        try {
            const saved = localStorage.getItem('gear_wars_achievements');
            if (saved) {
                const data = JSON.parse(saved);
                this.achievements = data.achievements || this.achievements;
                this.unlockedAchievements = data.unlockedAchievements || [];
                this.totalPoints = data.totalPoints || 0;
            }
        } catch (error) {
            console.error('Error loading achievement progress:', error);
        }
    }
    
    saveProgress() {
        try {
            const data = {
                achievements: this.achievements,
                unlockedAchievements: this.unlockedAchievements,
                totalPoints: this.totalPoints,
                lastSaved: Date.now()
            };
            localStorage.setItem('gear_wars_achievements', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving achievement progress:', error);
        }
    }
    
    checkAchievements(gameData, userData = null) {
        const unlocks = [];
        
        // First win
        if (gameData.won && !this.achievements.first_win.unlocked) {
            unlocks.push(this.unlockAchievement('first_win'));
        }
        
        // Comeback king (win with 1 HP)
        if (gameData.won && gameData.finalHealth === 1) {
            unlocks.push(this.unlockAchievement('comeback_king'));
        }
        
        // Speed demon (win in under 60 seconds)
        if (gameData.won && gameData.gameTime > 60) {
            unlocks.push(this.unlockAchievement('speed_demon'));
        }
        
        // Untouchable (win without damage)
        if (gameData.won && gameData.damageTaken === 0) {
            unlocks.push(this.unlockAchievement('untouchable'));
        }
        
        // Perfect parry
        if (gameData.parries >= 3) {
            unlocks.push(this.unlockAchievement('perfect_parry'));
        }
        
        // Stamina master
        if (gameData.boostsUsed >= 5) {
            unlocks.push(this.unlockAchievement('stamina_master'));
        }
        
        // Heat meister
        if (gameData.heatBursts >= 3) {
            unlocks.push(this.unlockAchievement('heat_meister'));
        }
        
        // Sharpshooter
        if (gameData.consecutiveHits >= 5) {
            unlocks.push(this.unlockAchievement('sharpshooter'));
        }
        
        // Gear collector progress
        if (gameData.gearsCollected > 0) {
            this.updateProgress('gear_collector', gameData.gearsCollected);
        }
        
        // Marathon runner progress (game played)
        this.updateProgress('marathon_runner', 1);
        
        // User data achievements
        if (userData) {
            // Rich warrior
            if (userData.balance >= 5000) {
                unlocks.push(this.unlockAchievement('rich_warrior'));
            } else {
                this.updateProgress('rich_warrior', userData.balance, true);
            }
            
            // Betting pro
            if (userData.bettingWins >= 10) {
                unlocks.push(this.unlockAchievement('betting_pro'));
            } else if (userData.bettingWins > 0) {
                this.updateProgress('betting_pro', userData.bettingWins);
            }
            
            // Unstoppable (win streak)
            if (userData.winStreak >= 5) {
                unlocks.push(this.unlockAchievement('unstoppable'));
            }
        }
        
        // Save progress after checking
        this.saveProgress();
        
        return unlocks.filter(achievement => achievement !== null);
    }
    
    unlockAchievement(achievementId) {
        const achievement = this.achievements[achievementId];
        if (!achievement || achievement.unlocked) return null;
        
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();
        this.unlockedAchievements.push(achievementId);
        this.totalPoints += achievement.points;
        
        console.log(`🏆 Achievement Unlocked: ${achievement.name} (+${achievement.points} points)`);
        this.showAchievementUnlock(achievement);
        
        return achievement;
    }
    
    updateProgress(achievementId, amount, isValue = false) {
        const achievement = this.achievements[achievementId];
        if (!achievement || achievement.unlocked || !achievement.progress) return;
        
        if (isValue) {
            achievement.progress.current = Math.max(achievement.progress.current, amount);
        } else {
            achievement.progress.current += amount;
        }
        
        // Check if target reached
        if (achievement.progress.current >= achievement.progress.target) {
            this.unlockAchievement(achievementId);
        }
    }
    
    showAchievementUnlock(achievement) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-popup">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-content">
                    <div class="achievement-header">
                        <span class="achievement-name">${achievement.name}</span>
                        <span class="achievement-points">+${achievement.points}</span>
                    </div>
                    <div class="achievement-desc">${achievement.desc}</div>
                    <div class="achievement-rarity ${achievement.rarity}">${this.getRarityText(achievement.rarity)}</div>
                </div>
                <div class="achievement-progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Animate progress bar
        setTimeout(() => {
            const progressFill = notification.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = '100%';
            }
        }, 500);
        
        // Remove after display
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 500);
        }, 4000);
    }
    
    getRarityText(rarity) {
        const rarityTexts = {
            common: 'Common',
            uncommon: 'Uncommon', 
            rare: 'Rare',
            epic: 'Epic',
            legendary: 'Legendary'
        };
        return rarityTexts[rarity] || rarity;
    }
    
    getRarityColor(rarity) {
        const rarityColors = {
            common: '#95a5a6',
            uncommon: '#2ecc71',
            rare: '#3498db', 
            epic: '#9b59b6',
            legendary: '#f1c40f'
        };
        return rarityColors[rarity] || '#95a5a6';
    }
    
    getUnlockedCount() {
        return this.unlockedAchievements.length;
    }
    
    getTotalAchievements() {
        return Object.keys(this.achievements).length;
    }
    
    getCompletionPercentage() {
        return Math.round((this.getUnlockedCount() / this.getTotalAchievements()) * 100);
    }
    
    getAchievementsByRarity() {
        const byRarity = {};
        Object.values(this.achievements).forEach(achievement => {
            if (!byRarity[achievement.rarity]) {
                byRarity[achievement.rarity] = [];
            }
            byRarity[achievement.rarity].push(achievement);
        });
        return byRarity;
    }
    
    getRecentUnlocks(limit = 5) {
        return this.unlockedAchievements
            .map(id => this.achievements[id])
            .filter(achievement => achievement && achievement.unlockedAt)
            .sort((a, b) => b.unlockedAt - a.unlockedAt)
            .slice(0, limit);
    }
    
    // Method to show achievement list in UI
    showAchievementsList() {
        this.createAchievementsModal();
    }
    
    createAchievementsModal() {
        // Remove existing modal
        const existingModal = document.getElementById('achievementsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'achievementsModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content achievements-modal">
                <div class="modal-header">
                    <h2>🏆 Achievements</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="achievements-summary">
                        <div class="summary-item">
                            <div class="summary-value">${this.getUnlockedCount()}/${this.getTotalAchievements()}</div>
                            <div class="summary-label">Unlocked</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-value">${this.getCompletionPercentage()}%</div>
                            <div class="summary-label">Complete</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-value">${this.totalPoints}</div>
                            <div class="summary-label">Points</div>
                        </div>
                    </div>
                    
                    <div class="achievements-list">
                        ${this.generateAchievementsHTML()}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animate in
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }
    
    generateAchievementsHTML() {
        let html = '';
        const byRarity = this.getAchievementsByRarity();
        const rarities = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        
        rarities.forEach(rarity => {
            if (byRarity[rarity]) {
                html += `<div class="achievement-rarity-section">
                    <h3 class="rarity-title ${rarity}">${this.getRarityText(rarity)}</h3>
                    <div class="achievement-grid">`;
                
                byRarity[rarity].forEach(achievement => {
                    const progress = achievement.progress ? 
                        `(${achievement.progress.current}/${achievement.progress.target})` : '';
                    
                    html += `
                        <div class="achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}">
                            <div class="achievement-icon">${achievement.icon}</div>
                            <div class="achievement-info">
                                <div class="achievement-name">${achievement.name}</div>
                                <div class="achievement-desc">${achievement.desc} ${progress}</div>
                                <div class="achievement-points">${achievement.points} points</div>
                                ${achievement.progress && !achievement.unlocked ? `
                                    <div class="achievement-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${(achievement.progress.current / achievement.progress.target) * 100}%"></div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="achievement-status">
                                ${achievement.unlocked ? '✅' : '🔒'}
                            </div>
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
        });
        
        return html;
    }
}

// Add achievement styles
const achievementStyles = `
    .achievement-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        max-width: 350px;
    }
    
    .achievement-notification.show {
        transform: translateX(0);
    }
    
    .achievement-popup {
        background: linear-gradient(135deg, #2c3e50, #34495e);
        border: 2px solid;
        border-radius: 12px;
        padding: 15px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        position: relative;
        overflow: hidden;
    }
    
    .achievement-popup::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #3498db, #2ecc71, #f1c40f, #e74c3c);
    }
    
    .achievement-icon {
        font-size: 2.5em;
        text-align: center;
        margin-bottom: 10px;
    }
    
    .achievement-content {
        text-align: center;
    }
    
    .achievement-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
    }
    
    .achievement-name {
        font-weight: bold;
        font-size: 1.1em;
        color: #ecf0f1;
    }
    
    .achievement-points {
        background: #f1c40f;
        color: #2c3e50;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: bold;
    }
    
    .achievement-desc {
        color: #bdc3c7;
        font-size: 0.9em;
        margin-bottom: 5px;
    }
    
    .achievement-rarity {
        font-size: 0.7em;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .achievement-progress-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(255,255,255,0.1);
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #2ecc71, #3498db);
        width: 0%;
        transition: width 2s ease-in-out;
    }
    
    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .modal-overlay.show {
        opacity: 1;
    }
    
    .achievements-modal {
        background: #2c3e50;
        border-radius: 12px;
        max-width: 800px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    
    .modal-header {
        background: #34495e;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #4a5f7a;
    }
    
    .modal-header h2 {
        margin: 0;
        color: #ecf0f1;
    }
    
    .modal-close {
        background: none;
        border: none;
        color: #bdc3c7;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
    }
    
    .modal-body {
        padding: 20px;
        max-height: calc(80vh - 80px);
        overflow-y: auto;
    }
    
    .achievements-summary {
        display: flex;
        justify-content: space-around;
        margin-bottom: 20px;
        padding: 20px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
    }
    
    .summary-item {
        text-align: center;
    }
    
    .summary-value {
        font-size: 1.8em;
        font-weight: bold;
        color: #3498db;
    }
    
    .summary-label {
        color: #bdc3c7;
        font-size: 0.9em;
    }
    
    .achievement-rarity-section {
        margin-bottom: 25px;
    }
    
    .rarity-title {
        margin: 0 0 15px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid;
        font-size: 1.2em;
    }
    
    .rarity-title.common { color: #95a5a6; border-color: #95a5a6; }
    .rarity-title.uncommon { color: #2ecc71; border-color: #2ecc71; }
    .rarity-title.rare { color: #3498db; border-color: #3498db; }
    .rarity-title.epic { color: #9b59b6; border-color: #9b59b6; }
    .rarity-title.legendary { color: #f1c40f; border-color: #f1c40f; }
    
    .achievement-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 15px;
    }
    
    .achievement-item {
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 15px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.3s ease;
    }
    
    .achievement-item.unlocked {
        border-left: 4px solid #2ecc71;
    }
    
    .achievement-item.locked {
        border-left: 4px solid #7f8c8d;
        opacity: 0.7;
    }
    
    .achievement-item:hover {
        background: rgba(255,255,255,0.1);
        transform: translateY(-2px);
    }
    
    .achievement-info {
        flex: 1;
    }
    
    .achievement-name {
        font-weight: bold;
        color: #ecf0f1;
        margin-bottom: 4px;
    }
    
    .achievement-desc {
        color: #bdc3c7;
        font-size: 0.85em;
        margin-bottom: 4px;
    }
    
    .achievement-points {
        color: #f1c40f;
        font-size: 0.8em;
        font-weight: bold;
    }
    
    .achievement-progress {
        margin-top: 8px;
    }
    
    .progress-bar {
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: #3498db;
        transition: width 0.3s ease;
    }
    
    .achievement-status {
        font-size: 1.2em;
    }
`;

// Inject styles
const achievementStyleSheet = document.createElement('style');
achievementStyleSheet.textContent = achievementStyles;
document.head.appendChild(achievementStyleSheet);

// Initialize achievement manager
const achievementManager = new AchievementManager();
window.achievementManager = achievementManager;

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AchievementManager;
                }
