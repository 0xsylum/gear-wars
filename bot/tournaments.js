class TournamentManager {
    constructor() {
        this.tournaments = new Map();
    }
    
    createTournament(creatorId, entryFee, maxPlayers) {
        const tournamentId = Date.now().toString();
        const tournament = {
            id: tournamentId,
            creatorId: creatorId,
            entryFee: entryFee,
            maxPlayers: maxPlayers,
            players: [creatorId],
            status: 'waiting',
            rounds: [],
            prizePool: entryFee
        };
        
        this.tournaments.set(tournamentId, tournament);
        return tournament;
    }
    
    joinTournament(tournamentId, userId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'waiting') {
            return false;
        }
        
        if (tournament.players.includes(userId)) {
            return false;
        }
        
        if (tournament.players.length >= tournament.maxPlayers) {
            return false;
        }
        
        tournament.players.push(userId);
        tournament.prizePool += tournament.entryFee;
        return true;
    }
    
    startTournament(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.players.length < 2) {
            return false;
        }
        
        tournament.status = 'active';
        this.generateBracket(tournament);
        return true;
    }
    
    generateBracket(tournament) {
        const players = [...tournament.players];
        // Simple shuffle
        players.sort(() => Math.random() - 0.5);
        
        const rounds = [];
        let currentRound = players;
        
        while (currentRound.length > 1) {
            const nextRound = [];
            const round = {
                matches: []
            };
            
            for (let i = 0; i < currentRound.length; i += 2) {
                if (i + 1 < currentRound.length) {
                    const match = {
                        player1: currentRound[i],
                        player2: currentRound[i + 1],
                        winner: null,
                        completed: false
                    };
                    round.matches.push(match);
                    nextRound.push(null); // Placeholder for winner
                } else {
                    nextRound.push(currentRound[i]); // Bye
                }
            }
            
            rounds.push(round);
            currentRound = nextRound;
        }
        
        tournament.rounds = rounds;
    }
}

module.exports = TournamentManager;
