const { v4: uuidv4 } = require('uuid');

class TournamentManager {
    constructor() {
        this.tournaments = new Map();
        this.activeMatches = new Map();
        this.leaderboard = new Map();
    }
    
    createTournament(creatorId, options = {}) {
        const tournamentId = uuidv4().substring(0, 8).toUpperCase();
        const defaultOptions = {
            name: `Tournament ${tournamentId}`,
            entryFee: 0,
            maxPlayers: 8,
            format: 'single_elimination',
            prizeDistribution: [50, 30, 20], // 1st, 2nd, 3rd place percentages
            isPublic: true,
            startTime: Date.now() + (30 * 60 * 1000), // 30 minutes from creation
            timePerRound: 300000, // 5 minutes per round
            ...options
        };
        
        const tournament = {
            id: tournamentId,
            creatorId: creatorId,
            options: defaultOptions,
            players: [{
                userId: creatorId,
                joinedAt: new Date(),
                paidEntry: defaultOptions.entryFee > 0 ? false : true
            }],
            status: 'registration',
            rounds: [],
            currentRound: 0,
            winners: [],
            prizePool: defaultOptions.entryFee,
            createdAt: new Date(),
            startedAt: null,
            completedAt: null
        };
        
        this.tournaments.set(tournamentId, tournament);
        console.log(`🎯 Tournament created: ${tournamentId} by ${creatorId}`);
        
        return tournament;
    }
    
    joinTournament(tournamentId, userId, userData = {}) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) {
            return { success: false, error: 'Tournament not found' };
        }
        
        if (tournament.status !== 'registration') {
            return { success: false, error: 'Tournament registration closed' };
        }
        
        if (tournament.players.length >= tournament.options.maxPlayers) {
            return { success: false, error: 'Tournament is full' };
        }
        
        const alreadyJoined = tournament.players.find(p => p.userId === userId);
        if (alreadyJoined) {
            return { success: false, error: 'Already joined tournament' };
        }
        
        // Check entry fee
        if (tournament.options.entryFee > 0) {
            if (userData.balance < tournament.options.entryFee) {
                return { success: false, error: 'Insufficient balance for entry fee' };
            }
            // Payment would be handled by the bot
        }
        
        tournament.players.push({
            userId: userId,
            username: userData.username,
            joinedAt: new Date(),
            paidEntry: tournament.options.entryFee > 0 ? false : true
        });
        
        tournament.prizePool += tournament.options.entryFee;
        
        console.log(`🎯 Player ${userId} joined tournament ${tournamentId}`);
        
        // Check if tournament should start
        if (tournament.players.length === tournament.options.maxPlayers) {
            this.startTournament(tournamentId);
        }
        
        return { 
            success: true, 
            tournament: this.getTournamentInfo(tournamentId),
            playersRemaining: tournament.options.maxPlayers - tournament.players.length
        };
    }
    
    startTournament(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'registration') {
            return false;
        }
        
        if (tournament.players.length < 2) {
            return false;
        }
        
        tournament.status = 'active';
        tournament.startedAt = new Date();
        tournament.currentRound = 0;
        
        // Generate bracket based on format
        this.generateBracket(tournament);
        
        console.log(`🎯 Tournament ${tournamentId} started with ${tournament.players.length} players`);
        
        // Notify all players
        this.broadcastToTournament(tournamentId, {
            type: 'tournament_started',
            tournamentId: tournamentId,
            round: tournament.currentRound,
            matches: tournament.rounds[tournament.currentRound]
        });
        
        return true;
    }
    
    generateBracket(tournament) {
        const players = [...tournament.players];
        
        // Simple shuffle for now (could implement seeding later)
        players.sort(() => Math.random() - 0.5);
        
        const rounds = [];
        let currentRoundPlayers = players;
        
        while (currentRoundPlayers.length > 1) {
            const round = {
                number: rounds.length,
                matches: [],
                startTime: Date.now() + (rounds.length * tournament.options.timePerRound)
            };
            
            const nextRoundPlayers = [];
            
            for (let i = 0; i < currentRoundPlayers.length; i += 2) {
                if (i + 1 < currentRoundPlayers.length) {
                    const match = {
                        id: uuidv4(),
                        player1: currentRoundPlayers[i],
                        player2: currentRoundPlayers[i + 1],
                        winner: null,
                        loser: null,
                        status: 'scheduled',
                        startTime: round.startTime,
                        gameId: null
                    };
                    round.matches.push(match);
                    nextRoundPlayers.push(null); // Placeholder for winner
                } else {
                    // Odd number of players - bye round
                    nextRoundPlayers.push(currentRoundPlayers[i]);
                }
            }
            
            rounds.push(round);
            currentRoundPlayers = nextRoundPlayers;
        }
        
        tournament.rounds = rounds;
    }
    
    reportMatchResult(tournamentId, matchId, winnerId, gameData = {}) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'active') {
            return { success: false, error: 'Tournament not active' };
        }
        
        const currentRound = tournament.rounds[tournament.currentRound];
        if (!currentRound) {
            return { success: false, error: 'No active round' };
        }
        
        const match = currentRound.matches.find(m => m.id === matchId);
        if (!match) {
            return { success: false, error: 'Match not found' };
        }
        
        if (match.status === 'completed') {
            return { success: false, error: 'Match already completed' };
        }
        
        // Validate winner is one of the players
        if (winnerId !== match.player1.userId && winnerId !== match.player2.userId) {
            return { success: false, error: 'Invalid winner' };
        }
        
        // Update match result
        match.winner = winnerId;
        match.loser = winnerId === match.player1.userId ? match.player2.userId : match.player1.userId;
        match.status = 'completed';
        match.completedAt = new Date();
        match.gameData = gameData;
        
        console.log(`🎯 Match ${matchId} completed. Winner: ${winnerId}`);
        
        // Update next round
        this.advanceWinner(tournament, match, winnerId);
        
        // Check if round is complete
        const roundComplete = currentRound.matches.every(m => m.status === 'completed');
        if (roundComplete) {
            this.completeRound(tournamentId);
        }
        
        // Broadcast match result
        this.broadcastToTournament(tournamentId, {
            type: 'match_result',
            tournamentId: tournamentId,
            match: match,
            round: tournament.currentRound
        });
        
        return { success: true, match: match };
    }
    
    advanceWinner(tournament, match, winnerId) {
        const nextRoundIndex = tournament.currentRound + 1;
        if (nextRoundIndex >= tournament.rounds.length) {
            // Tournament complete
            this.completeTournament(tournament.id, winnerId);
            return;
        }
        
        const nextRound = tournament.rounds[nextRoundIndex];
        if (!nextRound) return;
        
        // Find the next match that needs a player
        for (let match of nextRound.matches) {
            if (!match.player1) {
                match.player1 = { userId: winnerId };
                break;
            } else if (!match.player2) {
                match.player2 = { userId: winnerId };
                // Schedule the match
                match.status = 'ready';
                match.startTime = Date.now() + 60000; // Start in 1 minute
                break;
            }
        }
    }
    
    completeRound(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;
        
        tournament.currentRound++;
        console.log(`🎯 Tournament ${tournamentId} advanced to round ${tournament.currentRound}`);
        
        const nextRound = tournament.rounds[tournament.currentRound];
        if (nextRound) {
            // Broadcast next round start
            this.broadcastToTournament(tournamentId, {
                type: 'round_start',
                tournamentId: tournamentId,
                round: tournament.currentRound,
                matches: nextRound.matches
            });
        }
    }
    
    completeTournament(tournamentId, winnerId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;
        
        tournament.status = 'completed';
        tournament.completedAt = new Date();
        tournament.winner = winnerId;
        
        // Calculate prizes
        const prizes = this.calculatePrizes(tournament);
        
        console.log(`🏆 Tournament ${tournamentId} completed! Winner: ${winnerId}`);
        
        // Broadcast tournament completion
        this.broadcastToTournament(tournamentId, {
            type: 'tournament_completed',
            tournamentId: tournamentId,
            winner: winnerId,
            prizes: prizes,
            finalStandings: this.getFinalStandings(tournament)
        });
        
        // Clean up after some time
        setTimeout(() => {
            this.tournaments.delete(tournamentId);
        }, 3600000); // Clean up after 1 hour
    }
    
    calculatePrizes(tournament) {
        const distribution = tournament.options.prizeDistribution;
        const prizes = [];
        
        // For now, simple distribution to top 3
        if (distribution.length >= 1) {
            prizes.push({
                position: 1,
                userId: tournament.winner,
                amount: Math.floor(tournament.prizePool * (distribution[0] / 100)),
                percentage: distribution[0]
            });
        }
        
        // In a real implementation, you'd determine 2nd and 3rd places
        // based on the bracket results
        
        return prizes;
    }
    
    getFinalStandings(tournament) {
        // This would be calculated based on match results
        // For now, return simple standings
        return tournament.players.map(player => ({
            userId: player.userId,
            position: player.userId === tournament.winner ? 1 : 2 // Simplified
        }));
    }
    
    getTournamentInfo(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return null;
        
        return {
            id: tournament.id,
            name: tournament.options.name,
            status: tournament.status,
            players: tournament.players.length,
            maxPlayers: tournament.options.maxPlayers,
            entryFee: tournament.options.entryFee,
            prizePool: tournament.prizePool,
            currentRound: tournament.currentRound,
            totalRounds: tournament.rounds.length,
            creatorId: tournament.creatorId,
            isPublic: tournament.options.isPublic,
            startTime: tournament.options.startTime
        };
    }
    
    getActiveTournaments() {
        const active = [];
        for (let [id, tournament] of this.tournaments) {
            if (tournament.status === 'registration' || tournament.status === 'active') {
                active.push(this.getTournamentInfo(id));
            }
        }
        return active;
    }
    
    getTournamentStandings(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return null;
        
        const standings = [];
        
        // Add active players
        tournament.players.forEach(player => {
            standings.push({
                userId: player.userId,
                wins: 0, // Would calculate from match history
                losses: 0,
                position: null
            });
        });
        
        return standings;
    }
    
    broadcastToTournament(tournamentId, message) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;
        
        // In a real implementation, this would send to all connected players
        // For now, we'll just log it
        console.log(`📢 Tournament broadcast [${tournamentId}]:`, message.type);
        
        // This would integrate with your WebSocket system
        // tournament.players.forEach(player => {
        //     wsManager.sendToPlayer(player.userId, message);
        // });
    }
    
    // Admin functions
    cancelTournament(tournamentId, reason = 'Administrative cancellation') {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return false;
        
        tournament.status = 'cancelled';
        tournament.cancelledAt = new Date();
        tournament.cancellationReason = reason;
        
        // Refund entry fees
        if (tournament.options.entryFee > 0) {
            tournament.players.forEach(player => {
                if (player.paidEntry) {
                    // Refund logic would go here
                    console.log(`💰 Refunding ${tournament.options.entryFee} to ${player.userId}`);
                }
            });
        }
        
        this.broadcastToTournament(tournamentId, {
            type: 'tournament_cancelled',
            tournamentId: tournamentId,
            reason: reason
        });
        
        return true;
    }
    
    // Utility functions
    getTournamentByPlayer(userId) {
        for (let [id, tournament] of this.tournaments) {
            const isPlayer = tournament.players.find(p => p.userId === userId);
            if (isPlayer) {
                return this.getTournamentInfo(id);
            }
        }
        return null;
    }
    
    cleanupExpiredTournaments() {
        const now = Date.now();
        for (let [id, tournament] of this.tournaments) {
            // Clean up tournaments that never started and are old
            if (tournament.status === 'registration' && 
                tournament.createdAt < now - (24 * 60 * 60 * 1000)) { // 24 hours
                this.tournaments.delete(id);
                console.log(`🧹 Cleaned up expired tournament: ${id}`);
            }
            
            // Clean up completed tournaments after some time
            if (tournament.status === 'completed' && 
                tournament.completedAt < now - (2 * 60 * 60 * 1000)) { // 2 hours
                this.tournaments.delete(id);
                console.log(`🧹 Cleaned up old completed tournament: ${id}`);
            }
        }
    }
}

// Tournament-related WebSocket message handlers
function handleTournamentMessage(playerId, message, tournamentManager) {
    switch (message.type) {
        case 'create_tournament':
            const tournament = tournamentManager.createTournament(playerId, message.options);
            return { type: 'tournament_created', tournament: tournament };
            
        case 'join_tournament':
            const result = tournamentManager.joinTournament(message.tournamentId, playerId, message.userData);
            return { type: 'tournament_join_result', ...result };
            
        case 'get_tournaments':
            const tournaments = tournamentManager.getActiveTournaments();
            return { type: 'tournament_list', tournaments: tournaments };
            
        case 'get_tournament_info':
            const info = tournamentManager.getTournamentInfo(message.tournamentId);
            return { type: 'tournament_info', tournament: info };
            
        case 'report_match_result':
            const matchResult = tournamentManager.reportMatchResult(
                message.tournamentId, 
                message.matchId, 
                message.winnerId, 
                message.gameData
            );
            return { type: 'match_result_reported', ...matchResult };
            
        default:
            return { type: 'error', message: 'Unknown tournament message type' };
    }
}

module.exports = { TournamentManager, handleTournamentMessage };
