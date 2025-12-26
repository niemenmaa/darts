/**
 * Counter Mode - Game Logic
 * Multiplayer 301/501 dart game with score tracking
 */

import { getCookie, setCookie } from './cookie.js';
import { 
    sectors, 
    buildBoard, 
    getDistanceFromCenter, 
    INTERACTIVE_ZONE_MIN,
    getActiveSelection,
    slideOutSector,
    slideInSector,
    resetActiveSector
} from './board.js';

// Re-export board utilities for counter-app.js
export { 
    sectors, 
    buildBoard, 
    getDistanceFromCenter, 
    INTERACTIVE_ZONE_MIN,
    getActiveSelection,
    slideOutSector,
    slideInSector,
    resetActiveSector
};

const COUNTER_COOKIE_NAME = 'dartsCounterGame';
const HISTORY_COOKIE_NAME = 'dartsGameHistory';
const MAX_HISTORY_GAMES = 25;

// Game history - persisted across sessions
let gameHistory = [];

// Sync callback - called whenever state changes
let onStateChangeCallback = null;

// Game state
let gameState = {
    players: [],              // [{ name, score, history: [{ round, throws }] }]
    currentPlayerIndex: 0,
    startingScore: 301,
    doubleOut: true,
    currentTurn: {
        throws: [],           // [{ text, value, isDouble }]
        scoreAtStart: 0
    },
    gameStarted: false,
    winner: null,
    mentalMathMode: false
};

// Save game state to cookie
function saveGameState() {
    const expires = new Date();
    expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const value = encodeURIComponent(JSON.stringify(gameState));
    document.cookie = `${COUNTER_COOKIE_NAME}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    
    // Notify sync layer of state change
    notifyStateChange();
}

// Notify sync callback of state changes
function notifyStateChange() {
    if (onStateChangeCallback) {
        onStateChangeCallback({ ...gameState });
    }
}

// Load game state from cookie
function loadGameState() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === COUNTER_COOKIE_NAME) {
            try {
                const saved = JSON.parse(decodeURIComponent(value));
                if (saved && saved.players) {
                    gameState = { ...gameState, ...saved };
                    return true;
                }
            } catch (e) {
                console.error('Failed to parse counter game cookie:', e);
            }
        }
    }
    return false;
}

// Clear saved game
export function clearSavedGame() {
    document.cookie = `${COUNTER_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

// Check if there's a saved game
export function hasSavedGame() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === COUNTER_COOKIE_NAME && value) {
            try {
                const saved = JSON.parse(decodeURIComponent(value));
                return saved && saved.players && saved.players.length > 0;
            } catch (e) {
                return false;
            }
        }
    }
    return false;
}

// Load mental math setting from cookie
function loadSettings() {
    const saved = getCookie();
    if (saved) {
        gameState.mentalMathMode = saved.mentalMathMode ?? false;
    }
}

// Save game history to cookie
function saveGameHistory() {
    const expires = new Date();
    expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const value = encodeURIComponent(JSON.stringify(gameHistory));
    document.cookie = `${HISTORY_COOKIE_NAME}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

// Load game history from cookie
function loadGameHistory() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === HISTORY_COOKIE_NAME) {
            try {
                const saved = JSON.parse(decodeURIComponent(value));
                if (Array.isArray(saved)) {
                    gameHistory = saved;
                    return true;
                }
            } catch (e) {
                console.error('Failed to parse game history cookie:', e);
            }
        }
    }
    return false;
}

// Add completed game to history
function addGameToHistory() {
    const game = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        startingScore: gameState.startingScore,
        doubleOut: gameState.doubleOut,
        players: gameState.players.map(player => ({
            name: player.name,
            won: player.score === 0,
            finalScore: player.score,
            rounds: [...player.history]
        }))
    };
    
    gameHistory.unshift(game);
    
    // Keep only last MAX_HISTORY_GAMES
    if (gameHistory.length > MAX_HISTORY_GAMES) {
        gameHistory = gameHistory.slice(0, MAX_HISTORY_GAMES);
    }
    
    saveGameHistory();
}

// Get game history
export function getGameHistory() {
    return [...gameHistory];
}

// Clear game history
export function clearGameHistory() {
    gameHistory = [];
    document.cookie = `${HISTORY_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

// ==========================================
// Statistics Calculation Functions
// ==========================================

// Calculate points per turn (3 darts) from rounds
export function getPointsPerTurn(rounds) {
    if (!rounds || rounds.length === 0) return 0;
    
    let totalPoints = 0;
    let validRounds = 0;
    
    for (const round of rounds) {
        if (!round.bust) {
            const turnPoints = round.throws.reduce((sum, t) => sum + t.value, 0);
            totalPoints += turnPoints;
            validRounds++;
        }
    }
    
    return validRounds > 0 ? totalPoints / validRounds : 0;
}

// Calculate points per dart from rounds
export function getPointsPerDart(rounds) {
    if (!rounds || rounds.length === 0) return 0;
    
    let totalPoints = 0;
    let totalDarts = 0;
    
    for (const round of rounds) {
        for (const dart of round.throws) {
            totalPoints += dart.value;
            totalDarts++;
        }
    }
    
    return totalDarts > 0 ? totalPoints / totalDarts : 0;
}

// Count turns with 100+ points
export function getHundredPlusCount(rounds) {
    if (!rounds || rounds.length === 0) return 0;
    
    return rounds.filter(round => {
        if (round.bust) return false;
        const turnPoints = round.throws.reduce((sum, t) => sum + t.value, 0);
        return turnPoints >= 100;
    }).length;
}

// Calculate doubles percentage (doubles hit / doubles attempted)
export function getDoublesPercentage(rounds) {
    if (!rounds || rounds.length === 0) return 0;
    
    let doublesAttempted = 0;
    let doublesHit = 0;
    
    for (const round of rounds) {
        for (const dart of round.throws) {
            // Count doubles attempted (D prefix or bull 50)
            if (dart.text.startsWith('D') || dart.value === 50) {
                doublesAttempted++;
                doublesHit++;
            }
        }
    }
    
    // For a more accurate metric, we'd need to track attempted doubles that missed
    // For now, we just return 100% if any doubles were hit
    return doublesAttempted > 0 ? 100 : 0;
}

// Calculate first 9 darts average (first 3 turns)
export function getFirstNineAverage(rounds) {
    if (!rounds || rounds.length === 0) return 0;
    
    const first3Rounds = rounds.slice(0, 3);
    let totalPoints = 0;
    let totalDarts = 0;
    
    for (const round of first3Rounds) {
        for (const dart of round.throws) {
            totalPoints += dart.value;
            totalDarts++;
        }
    }
    
    // Return average per 3 darts (turn), scaled to 9 darts
    return totalDarts > 0 ? (totalPoints / totalDarts) * 3 : 0;
}

// Get total points scored in a game by a player
export function getTotalPointsScored(rounds, startingScore) {
    if (!rounds || rounds.length === 0) return 0;
    
    let totalPoints = 0;
    for (const round of rounds) {
        if (!round.bust) {
            const turnPoints = round.throws.reduce((sum, t) => sum + t.value, 0);
            totalPoints += turnPoints;
        }
    }
    
    return totalPoints;
}

// Calculate aggregate stats for a player across all games
export function calculatePlayerStats(playerName) {
    const playerGames = gameHistory.filter(game => 
        game.players.some(p => p.name === playerName)
    );
    
    if (playerGames.length === 0) {
        return {
            gamesPlayed: 0,
            gamesWon: 0,
            winRate: 0,
            avgPerTurn: 0,
            avgPerDart: 0,
            hundredPlusCount: 0,
            firstNineAvg: 0
        };
    }
    
    let totalRounds = [];
    let gamesWon = 0;
    
    for (const game of playerGames) {
        const playerData = game.players.find(p => p.name === playerName);
        if (playerData) {
            totalRounds = totalRounds.concat(playerData.rounds);
            if (playerData.won) gamesWon++;
        }
    }
    
    return {
        gamesPlayed: playerGames.length,
        gamesWon,
        winRate: (gamesWon / playerGames.length) * 100,
        avgPerTurn: getPointsPerTurn(totalRounds),
        avgPerDart: getPointsPerDart(totalRounds),
        hundredPlusCount: getHundredPlusCount(totalRounds),
        firstNineAvg: getFirstNineAverage(totalRounds)
    };
}

// Get current game stats for a player
export function getCurrentGameStats(player) {
    if (!player || !player.history) {
        return {
            avgPerTurn: 0,
            avgPerDart: 0,
            hundredPlusCount: 0,
            firstNineAvg: 0,
            totalPointsScored: 0
        };
    }
    
    return {
        avgPerTurn: getPointsPerTurn(player.history),
        avgPerDart: getPointsPerDart(player.history),
        hundredPlusCount: getHundredPlusCount(player.history),
        firstNineAvg: getFirstNineAverage(player.history),
        totalPointsScored: getTotalPointsScored(player.history, gameState.startingScore)
    };
}

// Initialize - load saved game if exists
loadSettings();
loadGameState();
loadGameHistory();

// Export game state getters
export function getGameState() {
    return { ...gameState };
}

export function getPlayers() {
    return [...gameState.players];
}

export function getCurrentPlayer() {
    return gameState.players[gameState.currentPlayerIndex] || null;
}

export function getCurrentTurn() {
    return { ...gameState.currentTurn };
}

export function isGameStarted() {
    return gameState.gameStarted;
}

export function getWinner() {
    return gameState.winner;
}

export function isMentalMathMode() {
    return gameState.mentalMathMode;
}

export function setMentalMathMode(enabled) {
    gameState.mentalMathMode = enabled;
    saveGameState();
}

// Player management
export function addPlayer(name) {
    if (!name || name.trim() === '') return false;
    gameState.players.push({
        name: name.trim(),
        score: gameState.startingScore,
        history: []
    });
    saveGameState();
    return true;
}

export function removePlayer(index) {
    if (index >= 0 && index < gameState.players.length) {
        gameState.players.splice(index, 1);
        saveGameState();
        return true;
    }
    return false;
}

export function updatePlayer(index, newName) {
    if (index >= 0 && index < gameState.players.length && newName.trim()) {
        gameState.players[index].name = newName.trim();
        saveGameState();
        return true;
    }
    return false;
}

export function movePlayer(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= gameState.players.length) return false;
    if (toIndex < 0 || toIndex >= gameState.players.length) return false;
    if (fromIndex === toIndex) return false;
    
    const [player] = gameState.players.splice(fromIndex, 1);
    gameState.players.splice(toIndex, 0, player);
    saveGameState();
    return true;
}

// Game setup
export function setGameMode(score) {
    if (score === 301 || score === 501) {
        gameState.startingScore = score;
        saveGameState();
        return true;
    }
    return false;
}

export function setDoubleOut(enabled) {
    gameState.doubleOut = enabled;
    saveGameState();
}

export function getDoubleOut() {
    return gameState.doubleOut;
}

export function getStartingScore() {
    return gameState.startingScore;
}

// Start the game
export function startGame() {
    if (gameState.players.length === 0) return false;
    
    // Reset all player scores
    gameState.players.forEach(player => {
        player.score = gameState.startingScore;
        player.history = [];
    });
    
    gameState.currentPlayerIndex = 0;
    gameState.gameStarted = true;
    gameState.winner = null;
    gameState.currentTurn = {
        throws: [],
        scoreAtStart: gameState.startingScore
    };
    
    saveGameState();
    return true;
}

// Reset for new game (keeps players)
export function resetGame() {
    gameState.gameStarted = false;
    gameState.winner = null;
    gameState.currentPlayerIndex = 0;
    gameState.currentTurn = { throws: [], scoreAtStart: 0 };
    saveGameState();
}

// Full reset (clears players too)
export function fullReset() {
    gameState.players = [];
    resetGame();
    clearSavedGame();
}

// Calculate current score during turn (for display)
export function getCurrentDisplayScore() {
    const player = getCurrentPlayer();
    if (!player) return 0;
    
    // In mental math mode, only show score at start of turn
    if (gameState.mentalMathMode) {
        return gameState.currentTurn.scoreAtStart;
    }
    
    // Otherwise, show real-time score
    const throwsTotal = gameState.currentTurn.throws.reduce((sum, t) => sum + t.value, 0);
    return gameState.currentTurn.scoreAtStart - throwsTotal;
}

// Get the actual current score (for internal logic)
function getActualCurrentScore() {
    const player = getCurrentPlayer();
    if (!player) return 0;
    const throwsTotal = gameState.currentTurn.throws.reduce((sum, t) => sum + t.value, 0);
    return gameState.currentTurn.scoreAtStart - throwsTotal;
}

// Add a throw
// Returns: { success, bust, win, message }
export function addThrow(text, value, isDouble = false) {
    if (!gameState.gameStarted || gameState.winner) {
        return { success: false, message: 'Game not in progress' };
    }
    
    const player = getCurrentPlayer();
    if (!player) return { success: false, message: 'No current player' };
    
    // Calculate new score
    const currentScore = getActualCurrentScore();
    const newScore = currentScore - value;
    
    // Check for bust (only in double-out mode)
    if (gameState.doubleOut) {
        // Bust conditions: < 0, = 1, or = 0 without double
        if (newScore < 0 || newScore === 1 || (newScore === 0 && !isDouble)) {
            // Record the throw that caused bust
            gameState.currentTurn.throws.push({ text, value, isDouble });
            
            // Bust! Reset to start of turn score and move to next player
            return handleBust();
        }
    }
    
    // Record the throw
    gameState.currentTurn.throws.push({ text, value, isDouble });
    saveGameState();
    
    // Check for win
    if (newScore === 0) {
        return handleWin();
    }
    
    // Check if turn is complete (3 throws)
    if (gameState.currentTurn.throws.length >= 3) {
        return completeTurn();
    }
    
    return { success: true, bust: false, win: false };
}

// Handle bust
function handleBust() {
    const player = getCurrentPlayer();
    const bustMessage = `Bust! ${player.name} stays at ${gameState.currentTurn.scoreAtStart}`;
    
    // Record turn in history (with bust flag)
    player.history.push({
        round: player.history.length + 1,
        throws: [...gameState.currentTurn.throws],
        bust: true,
        scoreAfter: gameState.currentTurn.scoreAtStart
    });
    
    // Move to next player
    advanceToNextPlayer();
    saveGameState();
    
    return { success: true, bust: true, win: false, message: bustMessage };
}

// Handle win
function handleWin() {
    const player = getCurrentPlayer();
    
    // Record final turn
    player.history.push({
        round: player.history.length + 1,
        throws: [...gameState.currentTurn.throws],
        bust: false,
        scoreAfter: 0
    });
    
    // Update player score
    player.score = 0;
    
    // Set winner
    gameState.winner = player;
    saveGameState();
    
    // Save completed game to history
    addGameToHistory();
    
    return { success: true, bust: false, win: true, message: `${player.name} wins!` };
}

// Complete turn normally
function completeTurn() {
    const player = getCurrentPlayer();
    const throwsTotal = gameState.currentTurn.throws.reduce((sum, t) => sum + t.value, 0);
    const newScore = gameState.currentTurn.scoreAtStart - throwsTotal;
    
    // Update player score
    player.score = newScore;
    
    // Record turn in history
    player.history.push({
        round: player.history.length + 1,
        throws: [...gameState.currentTurn.throws],
        bust: false,
        scoreAfter: newScore
    });
    
    // Move to next player
    advanceToNextPlayer();
    saveGameState();
    
    return { success: true, bust: false, win: false, turnComplete: true };
}

// Advance to next player
function advanceToNextPlayer() {
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = getCurrentPlayer();
    
    gameState.currentTurn = {
        throws: [],
        scoreAtStart: nextPlayer.score
    };
}

// Check if undo is possible (current turn has throws OR any player has history)
export function canUndo() {
    if (gameState.currentTurn.throws.length > 0) {
        return true;
    }
    // Check if any player has history we can undo to
    return gameState.players.some(player => player.history && player.history.length > 0);
}

// Undo last throw (works across turns)
export function undoThrow() {
    // If current turn has throws, just pop the last one
    if (gameState.currentTurn.throws.length > 0) {
        const removed = gameState.currentTurn.throws.pop();
        saveGameState();
        return { success: true, removed };
    }
    
    // Otherwise, go back to the previous player's last throw
    // Find the previous player (the one who just finished their turn)
    const previousPlayerIndex = (gameState.currentPlayerIndex - 1 + gameState.players.length) % gameState.players.length;
    const previousPlayer = gameState.players[previousPlayerIndex];
    
    // Check if previous player has history
    if (!previousPlayer.history || previousPlayer.history.length === 0) {
        return { success: false, message: 'No throws to undo' };
    }
    
    // Pop the last round from previous player's history
    const lastRound = previousPlayer.history.pop();
    
    // Restore their score to what it was before that round
    // If they have more history, use the scoreAfter from the previous round
    // Otherwise use the starting score
    if (previousPlayer.history.length > 0) {
        previousPlayer.score = previousPlayer.history[previousPlayer.history.length - 1].scoreAfter;
    } else {
        previousPlayer.score = gameState.startingScore;
    }
    
    // Switch back to the previous player
    gameState.currentPlayerIndex = previousPlayerIndex;
    
    // Restore their turn with all throws except the last one
    const throwsToRestore = lastRound.throws.slice(0, -1);
    const removed = lastRound.throws[lastRound.throws.length - 1];
    
    gameState.currentTurn = {
        throws: throwsToRestore,
        scoreAtStart: previousPlayer.score
    };
    
    saveGameState();
    return { success: true, removed, playerChanged: true };
}

// Get throw count for current turn
export function getCurrentThrowCount() {
    return gameState.currentTurn.throws.length;
}

// Get throws for current turn
export function getCurrentThrows() {
    return [...gameState.currentTurn.throws];
}

// ==========================================
// Sync Integration
// ==========================================

// Register callback for state changes (used by sync module)
export function onStateChange(callback) {
    onStateChangeCallback = callback;
}

// Get raw game state for syncing
export function getRawGameState() {
    return { ...gameState };
}

// Apply synced state from another device
// Returns true if UI should be updated
export function applySyncedState(syncedState, updateUICallback) {
    if (!syncedState) return false;
    
    // Merge synced state into local state
    gameState = {
        ...gameState,
        players: syncedState.players || gameState.players,
        currentPlayerIndex: syncedState.currentPlayerIndex ?? gameState.currentPlayerIndex,
        startingScore: syncedState.startingScore ?? gameState.startingScore,
        doubleOut: syncedState.doubleOut ?? gameState.doubleOut,
        currentTurn: syncedState.currentTurn || gameState.currentTurn,
        gameStarted: syncedState.gameStarted ?? gameState.gameStarted,
        winner: syncedState.winner,
        mentalMathMode: syncedState.mentalMathMode ?? gameState.mentalMathMode
    };
    
    // Save locally (but don't trigger sync callback to avoid loops)
    const expires = new Date();
    expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
    const value = encodeURIComponent(JSON.stringify(gameState));
    document.cookie = `${COUNTER_COOKIE_NAME}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    
    // Call UI update callback if provided
    if (updateUICallback) {
        updateUICallback();
    }
    
    return true;
}
