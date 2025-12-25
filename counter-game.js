/**
 * Counter Mode - Game Logic
 * Multiplayer 301/501 dart game with score tracking
 */

import { getCookie, setCookie } from './cookie.js';

// Dartboard sectors in clockwise order (for board rendering)
export const sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

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

// Build dartboard (reused from game.js with modifications)
export function buildBoard() {
    const totalSectors = sectors.length;
    const sectorAngle = 360 / totalSectors;

    let board = document.createElement('div');
    board.id = 'board';
    board.className = 'relative w-full aspect-square rounded-full mx-auto overflow-hidden';

    sectors.forEach((score, index) => {
        const sectorElement = document.createElement('div');
        sectorElement.dataset.score = score;
        const rotation = index * sectorAngle;
        const isEven = index % 2 === 0;

        const halfAngle = sectorAngle / 2;
        const rad = (halfAngle * Math.PI) / 180;
        const xOffset = 50 * Math.tan(rad);
        const leftX = 50 - xOffset;
        const rightX = 50 + xOffset;

        const baseColor = isEven ? '#1a1a1a' : '#f5f5dc';
        const ringColor = isEven ? '#dc2626' : '#16a34a';
        
        const gradient = `radial-gradient(circle closest-side at 50% 50%, 
            ${baseColor} 0%, 
            ${baseColor} 53%, 
            ${ringColor} 53%, 
            ${ringColor} 55%, 
            ${baseColor} 55%, 
            ${baseColor} 98%, 
            ${ringColor} 98%, 
            ${ringColor} 100%)`;

        sectorElement.className = 'absolute inset-0 flex items-start justify-center cursor-pointer transition-all hover:brightness-125 hover:z-10';
        sectorElement.style.cssText = `
            clip-path: polygon(50% 50%, ${leftX}% 0%, ${rightX}% 0%);
            transform: rotate(${rotation}deg);
            background: ${gradient};
        `;

        const label = document.createElement('span');
        label.className = 'mt-4 text-xs font-bold select-none';
        label.style.cssText = `
            transform: rotate(${-rotation}deg);
            color: ${isEven ? '#f5f5dc' : '#1a1a1a'};
        `;
        label.textContent = score;

        sectorElement.appendChild(label);
        board.appendChild(sectorElement);
    });

    // Center bullseye
    const bullseye = document.createElement('div');
    bullseye.className = 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-red-600 border-4 border-green-700 z-20 cursor-pointer hover:scale-110 transition-transform';
    bullseye.dataset.score = 50;
    board.appendChild(bullseye);

    return board;
}

// Get distance from board center as percentage
export function getDistanceFromCenter(event, board) {
    if (!board) return 0;
    
    const rect = board.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return (distance / radius) * 100;
}

// Interactive zone minimum (where triple ring starts)
export const INTERACTIVE_ZONE_MIN = 53;

