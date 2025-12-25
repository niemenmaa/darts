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

// Initialize - load saved game if exists
loadSettings();
loadGameState();

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

// Undo last throw (only within current turn)
export function undoThrow() {
    if (gameState.currentTurn.throws.length === 0) {
        return { success: false, message: 'No throws to undo' };
    }
    
    const removed = gameState.currentTurn.throws.pop();
    saveGameState();
    return { success: true, removed };
}

// Get throw count for current turn
export function getCurrentThrowCount() {
    return gameState.currentTurn.throws.length;
}

// Get throws for current turn
export function getCurrentThrows() {
    return [...gameState.currentTurn.throws];
}
