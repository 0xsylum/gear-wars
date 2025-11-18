const { ethers } = require('ethers');
const axios = require('axios');

class P3DIntegration {
    constructor() {
        // Try multiple RPC endpoints for 3DPass
        this.rpcEndpoints = [
            'https://rpc.3dpass.org',
            'https://rpc.3dpass.org:8545',
            'https://mainnet.3dpass.org'
        ];
        
        this.currentRpcIndex = 0;
        this.provider = null;
        
        // Bridged P3D on Ethereum (more reliable)
        this.p3dContractAddress = '0x4f3a4e37701402C61146071309e45A15843025E1';
        
        this.isEnabled = false;
        this.stakingPool = new Map();
        this.rewardRates = {
            win: 0.1,
            bet: 0.05,
            tournament: 1,
            referral: 0.2,
            participation: 0.01
        };
    }

    async initialize() {
        console.log('🔗 Testing 3DPass network connections...');
        
        // Try to connect to any available RPC
        for (let i = 0; i < this.rpcEndpoints.length; i++) {
            try {
                this.provider = new ethers.JsonRpcProvider(this.rpcEndpoints[i]);
                
                // Set a timeout for connection attempts
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout')), 5000)
                );
                
                const blockPromise = this.provider.getBlockNumber();
                const blockNumber = await Promise.race([blockPromise, timeoutPromise]);
                
                console.log(`✅ Connected to 3DPass network via ${this.rpcEndpoints[i]}`);
                console.log(`📦 Current block: ${blockNumber}`);
                
                this.isEnabled = true;
                this.currentRpcIndex = i;
                break;
                
            } catch (error) {
                console.log(`❌ Failed to connect to ${this.rpcEndpoints[i]}: ${error.message}`);
                
                if (i === this.rpcEndpoints.length - 1) {
                    // All endpoints failed
                    console.log('⚠️ All 3DPass RPC endpoints failed, running in simulation mode');
                    console.log('💡 P3D rewards will be tracked locally for testing');
                    this.isEnabled = false;
                }
            }
        }

        if (!this.isEnabled) {
            console.log('🎮 3DPass integration running in SIMULATION MODE');
            console.log('💰 P3D rewards are tracked locally for demonstration');
        }

        return this.isEnabled;
    }

    // Award P3D tokens for game achievements
    async awardTokens(userId, action, amount = null) {
        // Always use simulation mode for now since RPC is not accessible
        return this.simulateAward(userId, action, amount);
    }

    simulateAward(userId, action, amount = null) {
        const rewardAmount = amount || this.rewardRates[action] || 0;
        
        // Track in local storage for simulation
        if (!global.p3dSimulation) global.p3dSimulation = new Map();
        const userBalance = global.p3dSimulation.get(userId) || 0;
        global.p3dSimulation.set(userId, userBalance + rewardAmount);
        
        console.log(`🎯 [SIM] Awarded ${rewardAmount} P3D to ${userId} for ${action}`);
        
        return {
            success: true,
            amount: rewardAmount,
            action: action,
            token: 'P3D',
            simulated: true,
            balance: userBalance + rewardAmount,
            message: 'P3D awarded in simulation mode'
        };
    }

    // Staking system for P3D tokens
    async stakeTokens(userId, amount) {
        try {
            if (!this.stakingPool.has(userId)) {
                this.stakingPool.set(userId, {
                    amount: 0,
                    stakedAt: Date.now(),
                    rewards: 0,
                    token: 'P3D'
                });
            }
            
            const stake = this.stakingPool.get(userId);
            stake.amount += amount;
            
            console.log(`💰 ${userId} staked ${amount} P3D (simulation)`);
            
            return {
                success: true,
                stakedAmount: stake.amount,
                token: 'P3D',
                simulated: true,
                message: 'Staking in simulation mode - real P3D will be available when RPC is connected'
            };
        } catch (error) {
            console.error('❌ Staking failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Calculate staking rewards (15% APR)
    calculateStakingRewards(userId) {
        const stake = this.stakingPool.get(userId);
        if (!stake) return 0;
        
        const stakingTime = Date.now() - stake.stakedAt;
        const daysStaked = stakingTime / (1000 * 60 * 60 * 24);
        const apr = 0.15;
        const rewards = stake.amount * (apr / 365) * daysStaked;
        
        return Math.max(0, rewards);
    }

    // Get user P3D balance
    async getBalance(userId) {
        // Always return simulation balance since RPC is not accessible
        return global.p3dSimulation?.get(userId) || 0;
    }

    // P3D leaderboard
    getP3DLeaderboard() {
        if (!global.p3dSimulation) return [];
        
        return Array.from(global.p3dSimulation.entries())
            .map(([userId, balance]) => ({ userId, balance }))
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 10);
    }

    // Get network status
    getNetworkStatus() {
        return {
            connected: this.isEnabled,
            mode: this.isEnabled ? 'LIVE' : 'SIMULATION',
            currentRpc: this.isEnabled ? this.rpcEndpoints[this.currentRpcIndex] : 'None',
            message: this.isEnabled ? 
                'Connected to 3DPass network' : 
                'Running in simulation mode - P3D rewards tracked locally'
        };
    }
}

// P3D Game Integration Manager
class P3DGameManager {
    constructor() {
        this.p3d = new P3DIntegration();
        this.referralCodes = new Map();
    }

    async initialize() {
        await this.p3d.initialize();
        const status = this.p3d.getNetworkStatus();
        console.log(`🎮 3DPass Game Manager initialized - Mode: ${status.mode}`);
    }

    // Enhanced game result handler with P3D rewards
    async handleGameResult(userId, gameData) {
        const rewards = [];
        const networkStatus = this.p3d.getNetworkStatus();
        
        if (gameData.won) {
            const winReward = await this.p3d.awardTokens(userId, 'win');
            rewards.push(winReward);
            
            if (gameData.winStreak >= 3) {
                const streakBonus = await this.p3d.awardTokens(
                    userId, 
                    'streak_bonus', 
                    gameData.winStreak * 0.05
                );
                rewards.push(streakBonus);
            }
        }
        
        const participationReward = await this.p3d.awardTokens(
            userId, 
            'participation', 
            0.01
        );
        rewards.push(participationReward);
        
        return {
            gameResult: gameData,
            p3dRewards: rewards,
            totalAwarded: rewards.reduce((sum, r) => sum + r.amount, 0),
            token: 'P3D',
            networkMode: networkStatus.mode,
            message: networkStatus.message
        };
    }

    // Get user's P3D dashboard
    async getUserDashboard(userId) {
        const balance = await this.p3d.getBalance(userId);
        const stakingRewards = this.p3d.calculateStakingRewards(userId);
        const leaderboardPosition = this.getLeaderboardPosition(userId);
        const networkStatus = this.p3d.getNetworkStatus();
        
        return {
            balance: balance,
            stakingRewards: stakingRewards,
            leaderboardPosition: leaderboardPosition,
            totalEarned: balance + stakingRewards,
            referralCode: this.generateReferralCode(userId),
            network: '3DPass',
            token: 'P3D',
            networkMode: networkStatus.mode,
            message: networkStatus.message
        };
    }

    getLeaderboardPosition(userId) {
        const leaderboard = this.p3d.getP3DLeaderboard();
        const position = leaderboard.findIndex(entry => entry.userId === userId);
        return position >= 0 ? position + 1 : null;
    }

    generateReferralCode(userId) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.referralCodes.set(code, {
            userId: userId,
            createdAt: new Date(),
            uses: 0
        });
        return code;
    }
}

module.exports = { P3DIntegration, P3DGameManager };
