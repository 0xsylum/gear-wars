class AchievementManager {
    constructor() {
        this.achievements = {
            first_win: { name: "First Blood", desc: "Win your first battle", unlocked: false },
            gear_collector: { name: "Gear Collector", desc: "Collect 50 gears", count: 0, required: 50 },
            comeback_king: { name: "Comeback King", desc: "Win with 1 HP remaining", unlocked: false },
            speed_demon: { name: "Speed Demon", desc: "Win a battle in under 30 seconds", unlocked: false },
            untouchable: { name: "Untouchable", desc: "Win without taking damage", unlocked: false }
        };
    }
    
    checkAchievements(gameData) {
        const unlocks = [];
        
        // First win
        if (gameData.won && !this.achievements.first_win.unlocked) {
            this.achievements.first_win.unlocked = true;
            unlocks.push('first_win');
        }
        
        // Comeback king
        if (gameData.won && gameData.finalHealth === 1) {
            this.achievements.comeback_king.unlocked = true;
            unlocks.push('comeback_king');
        }
        
        // Speed demon
        if (gameData.won && gameData.gameTime > 30) {
            this.achievements.speed_demon.unlocked = true;
            unlocks.push('speed_demon');
        }
        
        // Untouchable
        if (gameData.won && gameData.damageTaken === 0) {
            this.achievements.untouchable.unlocked = true;
            unlocks.push('untouchable');
        }
        
        return unlocks;
    }
    
    showAchievementUnlock(achievementId) {
        const achievement = this.achievements[achievementId];
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-popup">
                <div class="achievement-icon">🏆</div>
                <div class="achievement-text">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-desc">${achievement.desc}</div>
                </div>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }
}
