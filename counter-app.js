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
    setMentalMathMode,
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
    canUndo,
    buildBoard,
    getDistanceFromCenter,
    INTERACTIVE_ZONE_MIN,
    getActiveSelection,
    slideOutSector,
    slideInSector,
    resetActiveSector,
    hasSavedGame,
    clearSavedGame,
    getGameHistory,
    getCurrentGameStats,
    calculatePlayerStats,
    getPointsPerTurn,
    getPointsPerDart,
    getHundredPlusCount,
    getFirstNineAverage,
    onStateChange,
    getRawGameState,
    applySyncedState
} from './counter-game.js';
import {
    generateRoomCode,
    connectToRoom,
    broadcastState,
    disconnect,
    getConnectionStatus,
    isInRoom,
    getRoomCode
} from './sync.js';
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
    setupSync();
    
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
// Sync Setup
// ==========================================

function setupSync() {
    // Register state change callback to broadcast changes
    onStateChange((state) => {
        if (isInRoom()) {
            broadcastState(state);
        }
    });
}

// ==========================================
// Menu
// ==========================================

function setupMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    const menuShareBtn = document.getElementById('menu-share-btn');
    const menuSettingsBtn = document.getElementById('menu-settings-btn');
    const menuNewGameBtn = document.getElementById('menu-new-game-btn');
    
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
    
    // Menu Share button
    menuShareBtn.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        openShareModal();
    });
    
    // Menu Settings button
    menuSettingsBtn.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        openSettingsModal();
    });
    
    // Menu New Game button
    menuNewGameBtn.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        openNewGameModal();
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
        updateMentalMathToggle();
        renderPlayerOrderList();
    } else if (screenName === 'game-play') {
        gamePlayScreen.classList.remove('hidden');
        updateGameUI();
    }
    
    // Show/hide menu game options based on screen
    const menuGameOptions = document.getElementById('menu-game-options');
    if (screenName === 'game-play') {
        menuGameOptions.classList.remove('hidden');
    } else {
        menuGameOptions.classList.add('hidden');
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
    const mentalMathToggle = document.getElementById('mental-math-toggle');
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
    
    // Mental math toggle
    mentalMathToggle.addEventListener('click', () => {
        const currentState = mentalMathToggle.dataset.enabled === 'true';
        setMentalMathMode(!currentState);
        updateMentalMathToggle();
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
        toggle.classList.remove('bg-slate-600');
        toggle.classList.add('bg-emerald-500');
        knob.classList.add('translate-x-5');
    } else {
        toggle.classList.add('bg-slate-600');
        toggle.classList.remove('bg-emerald-500');
        knob.classList.remove('translate-x-5');
    }
}

function updateMentalMathToggle() {
    const toggle = document.getElementById('mental-math-toggle');
    if (!toggle) return;
    const knob = toggle.querySelector('span');
    const enabled = isMentalMathMode();
    
    toggle.dataset.enabled = String(enabled);
    
    if (enabled) {
        toggle.classList.remove('bg-slate-600');
        toggle.classList.add('bg-emerald-500');
        knob.classList.add('translate-x-5');
    } else {
        toggle.classList.add('bg-slate-600');
        toggle.classList.remove('bg-emerald-500');
        knob.classList.remove('translate-x-5');
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
    
    // Update undo button state - enable if there's anything to undo (including previous turns)
    const undoBtn = document.getElementById('undo-btn');
    undoBtn.disabled = !canUndo();
    
    // Update all players scoreboard
    updateAllPlayersScoreboard();
}

function updateAllPlayersScoreboard() {
    const container = document.getElementById('all-players-scores');
    const players = getPlayers();
    const currentPlayer = getCurrentPlayer();
    
    if (players.length <= 1) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = players.map(player => {
        const isCurrent = currentPlayer && player.name === currentPlayer.name;
        const isWinner = player.score === 0;
        
        return `
            <div class="flex items-center gap-1.5 px-2 py-1 rounded-lg ${isCurrent ? 'bg-amber-500/30 ring-1 ring-amber-500/50' : 'bg-slate-800/60'}">
                <span class="text-xs font-medium ${isCurrent ? 'text-amber-300' : 'text-slate-400'} truncate max-w-16">${escapeHtml(player.name)}</span>
                <span class="text-sm font-bold tabular-nums ${isWinner ? 'text-emerald-400' : isCurrent ? 'text-amber-400' : 'text-white'}">${player.score}</span>
            </div>
        `;
    }).join('');
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
    const allScoresBtn = document.getElementById('all-scores-btn');
    
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
    
    allScoresBtn.addEventListener('click', () => {
        playerListModal.classList.add('hidden');
        playerListModal.classList.remove('flex');
        openAllScoresModal();
    });
    
    // All Scores modal
    const allScoresModal = document.getElementById('all-scores-modal');
    const closeAllScoresModal = document.getElementById('close-all-scores-modal');
    const backToScoresBtn = document.getElementById('back-to-scores-btn');
    
    closeAllScoresModal.addEventListener('click', () => {
        allScoresModal.classList.add('hidden');
        allScoresModal.classList.remove('flex');
    });
    
    backToScoresBtn.addEventListener('click', () => {
        allScoresModal.classList.add('hidden');
        allScoresModal.classList.remove('flex');
        openPlayerListModal();
    });
    
    allScoresModal.addEventListener('click', (e) => {
        if (e.target === allScoresModal) {
            allScoresModal.classList.add('hidden');
            allScoresModal.classList.remove('flex');
        }
    });
    
    // Winner modal
    const winnerModal = document.getElementById('winner-modal');
    const winnerSamePlayersBtn = document.getElementById('winner-same-players-btn');
    const winnerStartFreshBtn = document.getElementById('winner-start-fresh-btn');
    
    winnerSamePlayersBtn.addEventListener('click', () => {
        winnerModal.classList.add('hidden');
        winnerModal.classList.remove('flex');
        resetGame();
        showScreen('game-setup');
    });
    
    winnerStartFreshBtn.addEventListener('click', () => {
        winnerModal.classList.add('hidden');
        winnerModal.classList.remove('flex');
        fullReset();
        showScreen('player-setup');
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
    
    // Settings modal
    const settingsModal = document.getElementById('counter-settings-modal');
    const closeSettingsModal = document.getElementById('close-settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsMentalMathToggle = document.getElementById('settings-mental-math-toggle');
    
    closeSettingsModal.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('flex');
    });
    
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('flex');
    });
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
            settingsModal.classList.remove('flex');
        }
    });
    
    // Mental math toggle in settings modal
    settingsMentalMathToggle.addEventListener('click', () => {
        const currentState = settingsMentalMathToggle.dataset.enabled === 'true';
        setMentalMathMode(!currentState);
        updateSettingsMentalMathToggle();
        updateGameUI(); // Update display immediately
    });
    
    // Share game modal
    const shareModal = document.getElementById('share-game-modal');
    const closeShareModal = document.getElementById('close-share-modal');
    const closeShareBtn = document.getElementById('close-share-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const joinRoomInput = document.getElementById('join-room-input');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    closeShareModal.addEventListener('click', () => {
        shareModal.classList.add('hidden');
        shareModal.classList.remove('flex');
    });
    
    closeShareBtn.addEventListener('click', () => {
        shareModal.classList.add('hidden');
        shareModal.classList.remove('flex');
    });
    
    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            shareModal.classList.add('hidden');
            shareModal.classList.remove('flex');
        }
    });
    
    createRoomBtn.addEventListener('click', () => {
        const roomCode = generateRoomCode();
        connectToRoom(roomCode, handleSyncedState, handleConnectionChange);
        // Broadcast current state immediately after connecting
        setTimeout(() => {
            if (isInRoom()) {
                broadcastState(getRawGameState());
            }
        }, 500);
    });
    
    joinRoomBtn.addEventListener('click', () => {
        const code = joinRoomInput.value.trim().toUpperCase();
        if (code.length !== 6) {
            showJoinError('Please enter a 6-character code');
            return;
        }
        connectToRoom(code, handleSyncedState, handleConnectionChange);
    });
    
    joinRoomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinRoomBtn.click();
        }
    });
    
    // Auto-uppercase input
    joinRoomInput.addEventListener('input', () => {
        joinRoomInput.value = joinRoomInput.value.toUpperCase();
    });
    
    disconnectBtn.addEventListener('click', () => {
        disconnect();
        updateShareModalUI();
        updateSyncStatusIndicator();
    });
}

function openNewGameModal() {
    const modal = document.getElementById('new-game-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function openShareModal() {
    const modal = document.getElementById('share-game-modal');
    updateShareModalUI();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function updateShareModalUI() {
    const connectedStatus = document.getElementById('share-connected-status');
    const createSection = document.getElementById('share-create-section');
    const currentCode = document.getElementById('share-current-code');
    const joinError = document.getElementById('join-error');
    
    // Clear any previous errors
    joinError.classList.add('hidden');
    
    if (isInRoom()) {
        connectedStatus.classList.remove('hidden');
        createSection.classList.add('hidden');
        currentCode.textContent = getRoomCode();
    } else {
        connectedStatus.classList.add('hidden');
        createSection.classList.remove('hidden');
    }
}

function handleSyncedState(state) {
    // Apply the synced state and update UI
    applySyncedState(state, () => {
        // Determine which screen to show based on game state
        if (state.gameStarted) {
            if (currentScreen !== 'game-play') {
                setupBoard();
                showScreen('game-play');
            } else {
                updateGameUI();
            }
            if (state.winner) {
                showWinnerModal();
            }
        } else if (state.players && state.players.length > 0) {
            if (currentScreen === 'game-play') {
                showScreen('game-setup');
            }
            // Update player lists if on those screens
            if (currentScreen === 'player-setup') {
                renderPlayerList();
                updateContinueButton();
            } else if (currentScreen === 'game-setup') {
                renderPlayerOrderList();
            }
        }
    });
}

function handleConnectionChange(status) {
    updateShareModalUI();
    updateSyncStatusIndicator();
    
    if (status.error) {
        showJoinError('Failed to connect. Please try again.');
    }
}

function showJoinError(message) {
    const joinError = document.getElementById('join-error');
    joinError.textContent = message;
    joinError.classList.remove('hidden');
    
    setTimeout(() => {
        joinError.classList.add('hidden');
    }, 3000);
}

function updateSyncStatusIndicator() {
    const indicator = document.getElementById('sync-status');
    const codeDisplay = document.getElementById('sync-room-code');
    
    if (isInRoom()) {
        indicator.classList.remove('hidden');
        codeDisplay.textContent = getRoomCode();
    } else {
        indicator.classList.add('hidden');
    }
}

function openSettingsModal() {
    const modal = document.getElementById('counter-settings-modal');
    
    // Update displayed settings
    const startingScoreEl = document.getElementById('settings-starting-score');
    const doubleOutEl = document.getElementById('settings-double-out');
    
    startingScoreEl.textContent = getStartingScore();
    doubleOutEl.textContent = getDoubleOut() ? 'Yes' : 'No';
    doubleOutEl.className = `text-sm font-medium ${getDoubleOut() ? 'text-emerald-400' : 'text-slate-400'}`;
    
    // Update mental math toggle state
    updateSettingsMentalMathToggle();
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function updateSettingsMentalMathToggle() {
    const toggle = document.getElementById('settings-mental-math-toggle');
    if (!toggle) return;
    const knob = toggle.querySelector('span');
    const enabled = isMentalMathMode();
    
    toggle.dataset.enabled = String(enabled);
    
    if (enabled) {
        toggle.classList.remove('bg-slate-600');
        toggle.classList.add('bg-emerald-500');
        knob.classList.add('translate-x-5');
    } else {
        toggle.classList.add('bg-slate-600');
        toggle.classList.remove('bg-emerald-500');
        knob.classList.remove('translate-x-5');
    }
}

// Track expanded player in modal
let expandedPlayerIndex = null;

function openPlayerListModal() {
    const modal = document.getElementById('player-list-modal');
    expandedPlayerIndex = null;
    renderPlayerScoresModal();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function renderPlayerScoresModal() {
    const scoresContainer = document.getElementById('modal-player-scores');
    const players = getPlayers();
    const currentPlayer = getCurrentPlayer();
    
    scoresContainer.innerHTML = players.map((player, index) => {
        const isCurrent = currentPlayer && player.name === currentPlayer.name;
        const isWinner = player.score === 0;
        const isExpanded = expandedPlayerIndex === index;
        const stats = getCurrentGameStats(player);
        
        // Build rounds display
        let roundsHtml = '';
        if (isExpanded && player.history && player.history.length > 0) {
            roundsHtml = `
                <div class="mt-2 pt-2 border-t p-4 border-slate-600/50">
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                        <div class="text-slate-200">AVG/turn: <span class="text-white font-medium">${stats.avgPerTurn.toFixed(1)}</span></div>
                        <div class="text-slate-200">AVG/dart: <span class="text-white font-medium">${stats.avgPerDart.toFixed(1)}</span></div>
                        <div class="text-slate-200">100+: <span class="text-white font-medium">${stats.hundredPlusCount}</span></div>
                        <div class="text-slate-200">First 9: <span class="text-white font-medium">${stats.firstNineAvg.toFixed(1)}</span></div>
                    </div>
                    <div class="text-xs text-slate-200 mb-1">Rounds:</div>
                    <div class="flex flex-wrap gap-1">
                        ${player.history.map((round, i) => {
                            const turnTotal = round.throws.reduce((s, t) => s + t.value, 0);
                            const throwsStr = round.throws.map(t => t.text).join('-');
                            return `<span class="px-1.5 py-0.5 rounded text-xs ${round.bust ? 'bg-red-900/50 text-red-300' : turnTotal >= 100 ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-300'}" title="${throwsStr}">${turnTotal}${round.bust ? '✗' : ''}</span>`;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (isExpanded) {
            roundsHtml = `<div class="mt-2 pt-2 border-t border-slate-600/50 text-xs text-slate-500">No throws yet</div>`;
        }
        
        return `
            <div class="player-score-card rounded-xl transition-all cursor-pointer ${isCurrent ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'bg-slate-700/50 hover:bg-slate-700/70'}" data-player-index="${index}">
                <div class="flex items-center justify-between p-3">
                    <div class="flex items-center gap-2">
                        <span class="text-slate-500 text-sm">${isExpanded ? '▼' : '▶'}</span>
                        <span class="w-7 h-7 flex items-center justify-center ${isCurrent ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-slate-600'} text-${isCurrent ? 'slate-900' : 'white'} font-bold rounded-md text-xs">
                            ${index + 1}
                        </span>
                        <span class="text-white font-medium text-sm">${escapeHtml(player.name)}</span>
                    </div>
                    <span class="text-xl font-bold tabular-nums ${isWinner ? 'text-emerald-400' : 'text-white'}">${player.score}</span>
                </div>
                ${roundsHtml}
            </div>
        `;
    }).join('');
    
    // Add click handlers for expanding/collapsing
    scoresContainer.querySelectorAll('.player-score-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.playerIndex);
            expandedPlayerIndex = expandedPlayerIndex === index ? null : index;
            renderPlayerScoresModal();
        });
    });
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

function openAllScoresModal() {
    const modal = document.getElementById('all-scores-modal');
    const content = document.getElementById('all-scores-content');
    const history = getGameHistory();
    
    if (history.length === 0) {
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center text-slate-400 py-12">
                <div class="text-5xl mb-3 opacity-40">📊</div>
                <p class="text-base font-medium">No games played yet</p>
                <p class="text-sm text-slate-500 mt-1">Complete a game to see history</p>
            </div>
        `;
    } else {
        // Get all unique player names from history
        const allPlayerNames = new Set();
        history.forEach(game => {
            game.players.forEach(p => allPlayerNames.add(p.name));
        });
        const playerNames = Array.from(allPlayerNames);
        
        // Build table
        let tableHtml = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-slate-600">
                            <th class="text-left py-2 px-2 text-slate-400 font-medium text-xs">Game</th>
                            ${playerNames.map(name => `<th class="text-center py-2 px-2 text-slate-400 font-medium text-xs truncate max-w-20">${escapeHtml(name)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        history.forEach((game, i) => {
            const gameNum = history.length - i;
            const date = new Date(game.timestamp);
            const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
            
            tableHtml += `
                <tr class="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td class="py-2 px-2">
                        <div class="text-white font-medium">#${gameNum}</div>
                        <div class="text-xs text-slate-500">${game.startingScore} • ${dateStr}</div>
                    </td>
            `;
            
            playerNames.forEach(name => {
                const playerData = game.players.find(p => p.name === name);
                if (playerData) {
                    const totalScored = playerData.rounds.reduce((sum, r) => {
                        if (!r.bust) {
                            return sum + r.throws.reduce((s, t) => s + t.value, 0);
                        }
                        return sum;
                    }, 0);
                    
                    tableHtml += `
                        <td class="py-2 px-2 text-center">
                            <span class="font-bold tabular-nums ${playerData.won ? 'text-emerald-400' : 'text-white'}">${totalScored}</span>
                            ${playerData.won ? '<span class="text-emerald-400 ml-1">✓</span>' : ''}
                        </td>
                    `;
                } else {
                    tableHtml += `<td class="py-2 px-2 text-center text-slate-600">-</td>`;
                }
            });
            
            tableHtml += `</tr>`;
        });
        
        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Add player stats summary
        let statsHtml = `
            <div class="mt-4 pt-4 border-t border-slate-700">
                <h3 class="text-sm font-medium text-slate-400 mb-2">Player Statistics</h3>
                <div class="space-y-2">
        `;
        
        playerNames.forEach(name => {
            const stats = calculatePlayerStats(name);
            statsHtml += `
                <div class="bg-slate-700/50 rounded-lg p-2">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-white font-medium text-sm">${escapeHtml(name)}</span>
                        <span class="text-xs text-slate-400">${stats.gamesWon}/${stats.gamesPlayed} wins (${stats.winRate.toFixed(0)}%)</span>
                    </div>
                    <div class="grid grid-cols-4 gap-2 text-xs">
                        <div class="text-slate-400">AVG/T: <span class="text-white">${stats.avgPerTurn.toFixed(1)}</span></div>
                        <div class="text-slate-400">AVG/D: <span class="text-white">${stats.avgPerDart.toFixed(1)}</span></div>
                        <div class="text-slate-400">100+: <span class="text-white">${stats.hundredPlusCount}</span></div>
                        <div class="text-slate-400">F9: <span class="text-white">${stats.firstNineAvg.toFixed(1)}</span></div>
                    </div>
                </div>
            `;
        });
        
        statsHtml += `</div></div>`;
        
        content.innerHTML = tableHtml + statsHtml;
    }
    
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
