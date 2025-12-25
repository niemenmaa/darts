/**
 * Counter Mode - App Controller
 * UI and event handling for multiplayer darts
 */

import {
    sectors,
    getPlayers,
    getCurrentPlayer,
    getCurrentTurn,
    getCurrentDisplayScore,
    getCurrentThrowCount,
    getCurrentThrows,
    isGameStarted,
    getWinner,
    isMentalMathMode,
    addPlayer,
    removePlayer,
    updatePlayer,
    movePlayer,
    setGameMode,
    setDoubleOut,
    getDoubleOut,
    getStartingScore,
    startGame,
    resetGame,
    fullReset,
    addThrow,
    undoThrow,
    buildBoard,
    getDistanceFromCenter,
    INTERACTIVE_ZONE_MIN,
    getActiveSelection,
    slideOutSector,
    slideInSector,
    resetActiveSector,
    hasSavedGame,
    clearSavedGame
} from './counter-game.js';
import './style.css';

// Screen elements
let playerSetupScreen;
let gameSetupScreen;
let gamePlayScreen;

// Current screen
let currentScreen = 'player-setup';

// Board interaction state
let isDragging = false;
let lastDistance = null;
let lockedDirection = null;
let hasDragged = false;
let inInteractiveZone = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Counter Mode initialized');
    init();
});

function init() {
    // Cache screen elements
    playerSetupScreen = document.getElementById('player-setup-screen');
    gameSetupScreen = document.getElementById('game-setup-screen');
    gamePlayScreen = document.getElementById('game-play-screen');
    
    setupMenu();
    setupPlayerSetupScreen();
    setupGameSetupScreen();
    setupGamePlayScreen();
    setupModals();
    
    // Check for saved game and restore appropriate screen
    if (isGameStarted()) {
        // Game in progress - show game screen
        setupBoard();
        if (getWinner()) {
            showScreen('game-play');
            showWinnerModal();
        } else {
            showScreen('game-play');
        }
    } else if (getPlayers().length > 0) {
        // Players exist but game not started - show setup or player screen
        showScreen('player-setup');
    } else {
        showScreen('player-setup');
    }
}

// ==========================================
// Menu
// ==========================================

function setupMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    
    // Toggle menu
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('hidden');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuDropdown.contains(e.target) && e.target !== menuBtn) {
            menuDropdown.classList.add('hidden');
        }
    });
}

// ==========================================
// Screen Navigation
// ==========================================

function showScreen(screenName) {
    currentScreen = screenName;
    
    playerSetupScreen.classList.add('hidden');
    gameSetupScreen.classList.add('hidden');
    gamePlayScreen.classList.add('hidden');
    
    if (screenName === 'player-setup') {
        playerSetupScreen.classList.remove('hidden');
        renderPlayerList();
    } else if (screenName === 'game-setup') {
        gameSetupScreen.classList.remove('hidden');
        updateModeButtons();
        updateDoubleOutToggle();
        renderPlayerOrderList();
    } else if (screenName === 'game-play') {
        gamePlayScreen.classList.remove('hidden');
        updateGameUI();
    }
}

// ==========================================
// Player Setup Screen
// ==========================================

function setupPlayerSetupScreen() {
    const playerNameInput = document.getElementById('player-name-input');
    const addPlayerBtn = document.getElementById('add-player-btn');
    const toGameSetupBtn = document.getElementById('to-game-setup-btn');
    
    // Add player on button click
    addPlayerBtn.addEventListener('click', () => {
        if (addPlayer(playerNameInput.value)) {
            playerNameInput.value = '';
            playerNameInput.focus();
            renderPlayerList();
            updateContinueButton();
        }
    });
    
    // Add player on Enter key
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (addPlayer(playerNameInput.value)) {
                playerNameInput.value = '';
                renderPlayerList();
                updateContinueButton();
            }
        }
    });
    
    // Continue to game setup
    toGameSetupBtn.addEventListener('click', () => {
        if (getPlayers().length > 0) {
            showScreen('game-setup');
        }
    });
}

function renderPlayerList() {
    const playerList = document.getElementById('player-list');
    const players = getPlayers();
    
    if (players.length === 0) {
        playerList.innerHTML = `
            <div class="flex flex-col items-center justify-center text-slate-400 py-16">
                <div class="text-6xl mb-4 opacity-40">👥</div>
                <p class="text-lg font-medium">No players yet</p>
                <p class="text-sm text-slate-500 mt-1">Add at least one player to continue</p>
            </div>
        `;
        return;
    }
    
    playerList.innerHTML = players.map((player, index) => `
        <div class="flex items-center gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 group hover:border-slate-600 transition-all">
            <span class="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900 font-bold rounded-lg text-sm shadow-md">
                ${index + 1}
            </span>
            <span class="flex-1 text-white font-medium truncate">${escapeHtml(player.name)}</span>
            <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button class="move-up-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all ${index === 0 ? 'invisible' : ''}" data-index="${index}" title="Move up">
                    ↑
                </button>
                <button class="move-down-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all ${index === players.length - 1 ? 'invisible' : ''}" data-index="${index}" title="Move down">
                    ↓
                </button>
                <button class="edit-player-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded-lg transition-all" data-index="${index}" title="Edit">
                    ✏️
                </button>
                <button class="delete-player-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all" data-index="${index}" title="Remove">
                    ×
                </button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    playerList.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (movePlayer(index, index - 1)) {
                renderPlayerList();
            }
        });
    });
    
    playerList.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (movePlayer(index, index + 1)) {
                renderPlayerList();
            }
        });
    });
    
    playerList.querySelectorAll('.edit-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            const players = getPlayers();
            const newName = prompt('Edit player name:', players[index].name);
            if (newName !== null && newName.trim()) {
                updatePlayer(index, newName);
                renderPlayerList();
            }
        });
    });
    
    playerList.querySelectorAll('.delete-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            removePlayer(index);
            renderPlayerList();
            updateContinueButton();
        });
    });
}

function updateContinueButton() {
    const toGameSetupBtn = document.getElementById('to-game-setup-btn');
    toGameSetupBtn.disabled = getPlayers().length === 0;
}

// ==========================================
// Game Setup Screen
// ==========================================

function setupGameSetupScreen() {
    const mode301Btn = document.getElementById('mode-301-btn');
    const mode501Btn = document.getElementById('mode-501-btn');
    const doubleOutToggle = document.getElementById('double-out-toggle');
    const backToPlayersBtn = document.getElementById('back-to-players-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    
    // Mode selection
    mode301Btn.addEventListener('click', () => {
        setGameMode(301);
        updateModeButtons();
    });
    
    mode501Btn.addEventListener('click', () => {
        setGameMode(501);
        updateModeButtons();
    });
    
    // Double out toggle
    doubleOutToggle.addEventListener('click', () => {
        const currentState = doubleOutToggle.dataset.enabled === 'true';
        setDoubleOut(!currentState);
        updateDoubleOutToggle();
    });
    
    // Navigation
    backToPlayersBtn.addEventListener('click', () => {
        showScreen('player-setup');
    });
    
    startGameBtn.addEventListener('click', () => {
        if (startGame()) {
            setupBoard();
            showScreen('game-play');
        }
    });
}

function updateModeButtons() {
    const mode301Btn = document.getElementById('mode-301-btn');
    const mode501Btn = document.getElementById('mode-501-btn');
    const startingScore = getStartingScore();
    
    if (startingScore === 301) {
        mode301Btn.className = 'w-28 py-4 rounded-xl font-bold text-2xl transition-all bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30 scale-105';
        mode501Btn.className = 'w-28 py-4 rounded-xl font-bold text-2xl transition-all bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white';
    } else {
        mode301Btn.className = 'w-28 py-4 rounded-xl font-bold text-2xl transition-all bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white';
        mode501Btn.className = 'w-28 py-4 rounded-xl font-bold text-2xl transition-all bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30 scale-105';
    }
}

function updateDoubleOutToggle() {
    const toggle = document.getElementById('double-out-toggle');
    const knob = toggle.querySelector('span');
    const enabled = getDoubleOut();
    
    toggle.dataset.enabled = String(enabled);
    
    if (enabled) {
        toggle.classList.remove('bg-slate-600', 'border-slate-500');
        toggle.classList.add('bg-emerald-500', 'border-emerald-400');
        knob.classList.add('translate-x-6');
    } else {
        toggle.classList.add('bg-slate-600', 'border-slate-500');
        toggle.classList.remove('bg-emerald-500', 'border-emerald-400');
        knob.classList.remove('translate-x-6');
    }
}

function renderPlayerOrderList() {
    const listContainer = document.getElementById('player-order-list');
    const players = getPlayers();
    
    listContainer.innerHTML = players.map((player, index) => `
        <div class="flex items-center gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 group hover:border-slate-600 transition-all">
            <span class="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900 font-bold rounded-md text-xs shadow">
                ${index + 1}
            </span>
            <span class="flex-1 text-white font-medium truncate text-sm">${escapeHtml(player.name)}</span>
            <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <button class="order-move-up-btn w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-all text-sm ${index === 0 ? 'invisible' : ''}" data-index="${index}">
                    ↑
                </button>
                <button class="order-move-down-btn w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-all text-sm ${index === players.length - 1 ? 'invisible' : ''}" data-index="${index}">
                    ↓
                </button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    listContainer.querySelectorAll('.order-move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (movePlayer(index, index - 1)) {
                renderPlayerOrderList();
            }
        });
    });
    
    listContainer.querySelectorAll('.order-move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (movePlayer(index, index + 1)) {
                renderPlayerOrderList();
            }
        });
    });
}

// ==========================================
// Game Play Screen
// ==========================================

function setupGamePlayScreen() {
    const blankBtn = document.getElementById('blank-btn');
    const undoBtn = document.getElementById('undo-btn');
    const playerListBtn = document.getElementById('player-list-btn');
    const newGameIngameBtn = document.getElementById('new-game-ingame-btn');
    
    // Blank throw (0 points)
    blankBtn.addEventListener('click', () => {
        handleThrowInput({ text: '0', value: 0, isDouble: false });
    });
    
    // Undo last throw
    undoBtn.addEventListener('click', () => {
        const result = undoThrow();
        if (result.success) {
            updateGameUI();
        }
    });
    
    // Open player list modal
    playerListBtn.addEventListener('click', () => {
        openPlayerListModal();
    });
    
    // Open new game confirmation modal
    newGameIngameBtn.addEventListener('click', () => {
        openNewGameModal();
    });
}

function setupBoard() {
    const boardContainer = document.getElementById('board-container');
    boardContainer.innerHTML = '';
    
    const board = buildBoard();
    boardContainer.appendChild(board);
    
    setupBoardEventListeners(board);
}

function setupBoardEventListeners(board) {
    function getCenter() {
        const rect = board.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }
    
    function getLocalDistanceFromCenter(clientX, clientY) {
        const center = getCenter();
        const dx = clientX - center.x;
        const dy = clientY - center.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    let startedOnBull = false;
    
    function handleDragStart(clientX, clientY, event) {
        isDragging = true;
        hasDragged = false;
        lastDistance = getLocalDistanceFromCenter(clientX, clientY);
        lockedDirection = null;
        
        const sector = event.target.closest('[data-score]');
        const isBullseye = sector && sector.dataset.score === '50';
        startedOnBull = isBullseye;
        const distancePercent = getDistanceFromCenter(event, board);
        inInteractiveZone = isBullseye || distancePercent >= INTERACTIVE_ZONE_MIN;
    }
    
    function handleDragMove(clientX, clientY, event) {
        if (!isDragging || !inInteractiveZone) return;
        
        const currentDistance = getLocalDistanceFromCenter(clientX, clientY);
        const threshold = 5;
        
        if (!lockedDirection && Math.abs(currentDistance - lastDistance) > threshold) {
            lockedDirection = currentDistance > lastDistance ? 'out' : 'in';
            hasDragged = true;
        }
        
        // Use shared slide functions for highlighting
        if (lockedDirection === 'out') {
            slideOutSector(event);
        } else if (lockedDirection === 'in') {
            slideInSector(event);
        }
    }
    
    function handleDragEnd(event) {
        // Handle throw if we had a locked direction
        if (lockedDirection) {
            const selection = getActiveSelection();
            if (selection) {
                const isDouble = selection.text.startsWith('D') || selection.value === 50;
                handleThrowInput({ text: selection.text, value: selection.value, isDouble });
            }
        }
        
        resetActiveSector();
        isDragging = false;
        lastDistance = null;
        lockedDirection = null;
        inInteractiveZone = false;
        startedOnBull = false;
    }
    
    function handleClick(event) {
        if (hasDragged) {
            hasDragged = false;
            return;
        }
        
        const sector = event.target.closest('[data-score]');
        if (sector) {
            if (sector.dataset.score === '50') {
                // Bullseye
                handleThrowInput({ text: '50', value: 50, isDouble: true });
            } else {
                const distancePercent = getDistanceFromCenter(event, board);
                if (distancePercent >= INTERACTIVE_ZONE_MIN) {
                    const score = parseInt(sector.dataset.score);
                    handleThrowInput({ text: String(score), value: score, isDouble: false });
                }
            }
        }
    }
    
    // Mouse events
    board.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY, e));
    board.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY, e));
    board.addEventListener('mouseup', (e) => handleDragEnd(e));
    board.addEventListener('mouseleave', (e) => handleDragEnd(e));
    board.addEventListener('click', handleClick);
    
    // Touch events
    board.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY, e);
    }, { passive: true });
    
    board.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        handleDragMove(touch.clientX, touch.clientY, e);
    }, { passive: true });
    
    board.addEventListener('touchend', (e) => handleDragEnd(e));
    board.addEventListener('touchcancel', (e) => handleDragEnd(e));
}

function handleThrowInput(throwData) {
    if (getWinner()) return;
    
    const result = addThrow(throwData.text, throwData.value, throwData.isDouble);
    
    if (result.success) {
        updateGameUI();
        
        if (result.bust) {
            showGameMessage(result.message, 'text-red-400');
        } else if (result.win) {
            showWinnerModal();
        } else if (result.turnComplete) {
            showGameMessage('Next player', 'text-slate-400');
        }
    }
}

function updateGameUI() {
    const player = getCurrentPlayer();
    if (!player) return;
    
    // Update score display
    const remainingScore = document.getElementById('remaining-score');
    remainingScore.textContent = getCurrentDisplayScore();
    
    // Update player name
    const currentPlayerName = document.getElementById('current-player-name');
    currentPlayerName.textContent = player.name;
    
    // Update turn throws display
    const turnThrows = document.getElementById('turn-throws');
    const throws = getCurrentThrows();
    if (throws.length > 0) {
        turnThrows.textContent = throws.map(t => t.text).join('  •  ');
    } else {
        turnThrows.textContent = '';
    }
    
    // Update undo button state
    const undoBtn = document.getElementById('undo-btn');
    undoBtn.disabled = throws.length === 0;
}

function showGameMessage(message, colorClass = 'text-slate-400') {
    const gameMessage = document.getElementById('game-message');
    gameMessage.textContent = message;
    gameMessage.className = `text-center text-lg font-bold mt-3 h-8 ${colorClass}`;
    
    setTimeout(() => {
        gameMessage.textContent = '';
    }, 1500);
}

// ==========================================
// Modals
// ==========================================

function setupModals() {
    // Player list modal
    const closePlayerListModal = document.getElementById('close-player-list-modal');
    const playerListModal = document.getElementById('player-list-modal');
    const newGameBtn = document.getElementById('new-game-btn');
    
    closePlayerListModal.addEventListener('click', () => {
        playerListModal.classList.add('hidden');
        playerListModal.classList.remove('flex');
    });
    
    playerListModal.addEventListener('click', (e) => {
        if (e.target === playerListModal) {
            playerListModal.classList.add('hidden');
            playerListModal.classList.remove('flex');
        }
    });
    
    newGameBtn.addEventListener('click', () => {
        playerListModal.classList.add('hidden');
        playerListModal.classList.remove('flex');
        openNewGameModal();
    });
    
    // Winner modal
    const winnerModal = document.getElementById('winner-modal');
    const winnerNewGameBtn = document.getElementById('winner-new-game-btn');
    
    winnerNewGameBtn.addEventListener('click', () => {
        winnerModal.classList.add('hidden');
        winnerModal.classList.remove('flex');
        openNewGameModal();
    });
    
    // New game confirmation modal
    const newGameModal = document.getElementById('new-game-modal');
    const keepPlayersBtn = document.getElementById('new-game-keep-players-btn');
    const clearAllBtn = document.getElementById('new-game-clear-all-btn');
    const cancelBtn = document.getElementById('new-game-cancel-btn');
    
    keepPlayersBtn.addEventListener('click', () => {
        newGameModal.classList.add('hidden');
        newGameModal.classList.remove('flex');
        resetGame();
        showScreen('game-setup');
    });
    
    clearAllBtn.addEventListener('click', () => {
        newGameModal.classList.add('hidden');
        newGameModal.classList.remove('flex');
        fullReset();
        showScreen('player-setup');
    });
    
    cancelBtn.addEventListener('click', () => {
        newGameModal.classList.add('hidden');
        newGameModal.classList.remove('flex');
    });
    
    newGameModal.addEventListener('click', (e) => {
        if (e.target === newGameModal) {
            newGameModal.classList.add('hidden');
            newGameModal.classList.remove('flex');
        }
    });
}

function openNewGameModal() {
    const modal = document.getElementById('new-game-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function openPlayerListModal() {
    const modal = document.getElementById('player-list-modal');
    const scoresContainer = document.getElementById('modal-player-scores');
    const players = getPlayers();
    const currentPlayer = getCurrentPlayer();
    
    scoresContainer.innerHTML = players.map((player, index) => {
        const isCurrent = currentPlayer && player.name === currentPlayer.name;
        const isWinner = player.score === 0;
        return `
            <div class="flex items-center justify-between p-3 rounded-xl transition-all ${isCurrent ? 'bg-amber-500/20 ring-2 ring-amber-500/50' : 'bg-slate-700/50'}">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 flex items-center justify-center ${isCurrent ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-slate-600'} text-${isCurrent ? 'slate-900' : 'white'} font-bold rounded-lg text-sm">
                        ${index + 1}
                    </span>
                    <span class="text-white font-medium">${escapeHtml(player.name)}</span>
                </div>
                <span class="text-2xl font-bold tabular-nums ${isWinner ? 'text-emerald-400' : 'text-white'}">${player.score}</span>
            </div>
        `;
    }).join('');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function showWinnerModal() {
    const winner = getWinner();
    if (!winner) return;
    
    const modal = document.getElementById('winner-modal');
    const winnerName = document.getElementById('winner-name');
    
    winnerName.textContent = winner.name;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ==========================================
// Utilities
// ==========================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
