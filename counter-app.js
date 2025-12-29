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
    isSelfScoreOnly,
    setSelfScoreOnly,
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
    applySyncedState,
    // Profile functions
    getProfile,
    hasProfile,
    createProfile,
    updateProfileName,
    deleteProfile,
    addProfilePlayer,
    removeProfilePlayer,
    isProfilePlayerInGame,
    recalculateProfileStats
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

// Track previous player index to detect turn changes
let previousPlayerIndex = null;

// Track if we need to add profile player after receiving initial state (for joiners)
let pendingProfileAdd = false;

// Vibration setting (stored locally, not synced)
let vibrateOnTurnEnabled = false;

// Load vibration setting from localStorage
function loadVibrationSetting() {
    const saved = localStorage.getItem('dartsVibrateOnTurn');
    vibrateOnTurnEnabled = saved === 'true';
}

// Save vibration setting to localStorage
function saveVibrationSetting() {
    localStorage.setItem('dartsVibrateOnTurn', String(vibrateOnTurnEnabled));
}

// Initialize vibration setting on load
loadVibrationSetting();

// ==========================================
// Vibration Utilities
// ==========================================

/**
 * Vibrate the phone if the Vibration API is supported and setting is enabled
 * @param {number} duration - Vibration duration in milliseconds
 */
function vibratePhone(duration = 200) {
    if (vibrateOnTurnEnabled && 'vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

/**
 * Check if it's the local profile player's turn
 * @returns {boolean} True if it's the local user's turn to throw
 */
function isMyTurn() {
    const profile = getProfile();
    const currentPlayer = getCurrentPlayer();
    return profile && currentPlayer && currentPlayer.isProfilePlayer && currentPlayer.name === profile.name;
}

/**
 * Handle turn change - vibrate if it's now the local player's turn
 * @param {number} newPlayerIndex - The new current player index
 */
function handleTurnChange(newPlayerIndex) {
    if (previousPlayerIndex !== null && previousPlayerIndex !== newPlayerIndex) {
        // Turn has changed - check if it's now my turn
        if (isMyTurn()) {
            vibratePhone(300); // Slightly longer vibration for turn notification
            showGameMessage("It's your turn!", 'text-emerald-400');
        }
    }
    previousPlayerIndex = newPlayerIndex;
}

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
    setupProfileSection();
    setupPlayerSetupScreen();
    setupGameSetupScreen();
    setupGamePlayScreen();
    setupModals();
    setupSync();
    
    // Try to restore connection from previous session
    restoreConnection();
    
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
    const menuHostBtn = document.getElementById('menu-host-btn');
    const menuJoinBtn = document.getElementById('menu-join-btn');
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
    
    // Menu Host button
    menuHostBtn.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        openHostModal();
    });
    
    // Menu Join button
    menuJoinBtn.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        openJoinModal();
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
// Profile Section
// ==========================================

// Track if profile player is participating in next game
let profilePlaying = true;

function setupProfileSection() {
    const createProfileBtn = document.getElementById('create-profile-btn');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const profilePlayingToggle = document.getElementById('profile-playing-toggle');
    
    // Create profile button
    createProfileBtn.addEventListener('click', () => {
        openCreateProfileModal();
    });
    
    // Edit profile button
    editProfileBtn.addEventListener('click', () => {
        openEditProfileModal();
    });
    
    // Profile playing toggle
    profilePlayingToggle.addEventListener('click', () => {
        profilePlaying = !profilePlaying;
        updateProfilePlayingToggle();
        updateProfilePlayerInGame();
        updateContinueButton();
        
        // Broadcast state change if in a room
        if (isInRoom()) {
            broadcastState(getRawGameState());
        }
    });
    
    // Initialize profile UI
    updateProfileSection();
}

function updateProfileSection() {
    const noProfileCard = document.getElementById('no-profile-card');
    const profileCard = document.getElementById('profile-card');
    
    if (hasProfile()) {
        noProfileCard.classList.add('hidden');
        profileCard.classList.remove('hidden');
        
        const profile = getProfile();
        document.getElementById('profile-name-display').textContent = profile.name;
        
        // Display quick stats
        const stats = profile.stats;
        const winRate = stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(0) : 0;
        const avgPerDart = stats.totalDarts > 0 ? (stats.totalPoints / stats.totalDarts).toFixed(1) : 0;
        document.getElementById('profile-stats-display').textContent = 
            `${stats.gamesWon} wins • ${avgPerDart} avg`;
        
        // Sync profilePlaying state with actual game state (for when receiving synced state)
        // Only sync if in a room, otherwise keep user's toggle preference
        if (isInRoom()) {
            profilePlaying = isProfilePlayerInGame();
        }
        
        updateProfilePlayingToggle();
        
        // Ensure profile player is in game if toggle is on (only update if not receiving sync)
        if (!isInRoom()) {
            updateProfilePlayerInGame();
        }
    } else {
        noProfileCard.classList.remove('hidden');
        profileCard.classList.add('hidden');
    }
}

function updateProfilePlayingToggle() {
    const toggle = document.getElementById('profile-playing-toggle');
    const label = document.getElementById('profile-playing-label');
    const knob = toggle.querySelector('span');
    
    toggle.dataset.enabled = String(profilePlaying);
    
    if (profilePlaying) {
        toggle.classList.remove('bg-slate-600');
        toggle.classList.add('bg-emerald-500');
        knob.classList.add('translate-x-5');
        label.textContent = 'Playing';
        label.classList.remove('text-slate-500');
        label.classList.add('text-emerald-400');
    } else {
        toggle.classList.add('bg-slate-600');
        toggle.classList.remove('bg-emerald-500');
        knob.classList.remove('translate-x-5');
        label.textContent = 'Not playing';
        label.classList.add('text-slate-500');
        label.classList.remove('text-emerald-400');
    }
}

function updateProfilePlayerInGame() {
    if (!hasProfile()) return;
    
    if (profilePlaying) {
        // Add profile player if not already in game
        if (!isProfilePlayerInGame()) {
            addProfilePlayer();
        }
    } else {
        // Remove profile player if in game
        if (isProfilePlayerInGame()) {
            removeProfilePlayer();
        }
    }
    
    // Re-render the player list to reflect changes
    renderPlayerList();
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
        updateProfileSection();
        updateLobbyStatus();
        renderPlayerList();
        updateContinueButton();
    } else if (screenName === 'game-setup') {
        gameSetupScreen.classList.remove('hidden');
        updateModeButtons();
        updateDoubleOutToggle();
        updateMentalMathToggle();
        updateSelfScoreToggle();
        updateHostOnlyControls();
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
            // Broadcast if in room
            if (isInRoom()) {
                broadcastState(getRawGameState());
            }
        }
    });
    
    // Add player on Enter key
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (addPlayer(playerNameInput.value)) {
                playerNameInput.value = '';
                renderPlayerList();
                updateContinueButton();
                // Broadcast if in room
                if (isInRoom()) {
                    broadcastState(getRawGameState());
                }
            }
        }
    });
    
    // Continue to game setup
    toGameSetupBtn.addEventListener('click', () => {
        if (getPlayers().length > 0) {
            showScreen('game-setup');
        }
    });
    
    // Lobby disconnect button
    const lobbyDisconnectBtn = document.getElementById('lobby-disconnect-btn');
    lobbyDisconnectBtn.addEventListener('click', () => {
        // Remove local profile player before disconnecting
        if (hasProfile() && isProfilePlayerInGame()) {
            removeProfilePlayer();
            // Broadcast the removal before disconnecting
            if (isInRoom()) {
                broadcastState(getRawGameState());
            }
        }
        // Small delay to let the broadcast go through
        setTimeout(() => {
            clearConnectionState();
            disconnect();
            updateLobbyStatus();
            updateSyncStatusIndicator();
            renderPlayerList();
            updateContinueButton();
        }, 100);
    });
}

function renderPlayerList() {
    const playerList = document.getElementById('player-list');
    const players = getPlayers();
    const localProfile = getProfile();
    
    // Filter out only the LOCAL profile player - they're shown in the profile card
    // But show other profile players (from other devices) in the lobby
    const isLocalProfilePlayer = (player) => {
        return player.isProfilePlayer && localProfile && player.name === localProfile.name;
    };
    
    const lobbyPlayers = players.filter(p => !isLocalProfilePlayer(p));
    
    if (lobbyPlayers.length === 0) {
        // Check if we have any players at all (local profile might be playing)
        if (players.length === 0 || !isProfilePlayerInGame()) {
            playerList.innerHTML = `
                <div class="flex flex-col items-center justify-center text-slate-400 py-8">
                    <div class="text-4xl mb-2 opacity-40">👥</div>
                    <p class="text-sm text-slate-500">No other players yet</p>
                </div>
            `;
        } else {
            playerList.innerHTML = '';
        }
        return;
    }
    
    playerList.innerHTML = lobbyPlayers.map((player) => {
        // Find the actual index in the full players array
        const actualIndex = players.findIndex(p => p === player);
        const displayIndex = lobbyPlayers.indexOf(player) + 1;
        const isRemoteProfile = player.isProfilePlayer;
        
        // Visual styling for profile players vs guests
        const cardClass = isRemoteProfile 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-slate-800/60 border-slate-700/50';
        const badgeClass = isRemoteProfile
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
            : 'bg-slate-600 text-white';
        const labelText = isRemoteProfile ? 'Player' : 'Guest';
        const labelClass = isRemoteProfile ? 'text-emerald-400' : 'text-slate-500';
        
        // Determine action buttons based on player type and host status
        let actionsHtml = '';
        if (isRemoteProfile) {
            // Remote profile players can only be kicked by the host
            if (isHosting && isInRoom()) {
                actionsHtml = `
                    <button class="kick-player-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all opacity-60 group-hover:opacity-100" data-index="${actualIndex}" title="Kick">
                        🚫
                    </button>
                `;
            }
        } else {
            // Guests can be edited/removed by anyone
            actionsHtml = `
                <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button class="edit-player-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded-lg transition-all" data-index="${actualIndex}" title="Edit">
                        ✏️
                    </button>
                    <button class="delete-player-btn w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-all" data-index="${actualIndex}" title="Remove">
                        ×
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="flex items-center gap-2 p-3 ${cardClass} rounded-xl border group hover:border-slate-600 transition-all">
                <span class="w-8 h-8 flex items-center justify-center ${badgeClass} font-bold rounded-lg text-sm shadow-md">
                    ${displayIndex}
                </span>
                <span class="flex-1 text-white font-medium truncate">${escapeHtml(player.name)}</span>
                <span class="text-xs ${labelClass} mr-2">${labelText}</span>
                ${actionsHtml}
            </div>
        `;
    }).join('');
    
    playerList.querySelectorAll('.edit-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            const players = getPlayers();
            const newName = prompt('Edit guest name:', players[index].name);
            if (newName !== null && newName.trim()) {
                updatePlayer(index, newName);
                renderPlayerList();
                // Broadcast if in room
                if (isInRoom()) {
                    broadcastState(getRawGameState());
                }
            }
        });
    });
    
    playerList.querySelectorAll('.delete-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            removePlayer(index);
            renderPlayerList();
            updateContinueButton();
            // Broadcast if in room
            if (isInRoom()) {
                broadcastState(getRawGameState());
            }
        });
    });
    
    // Kick button handler (host only)
    playerList.querySelectorAll('.kick-player-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            const players = getPlayers();
            const playerName = players[index]?.name || 'this player';
            if (confirm(`Kick ${playerName} from the lobby?`)) {
                removePlayer(index);
                renderPlayerList();
                updateContinueButton();
                // Broadcast if in room
                if (isInRoom()) {
                    broadcastState(getRawGameState());
                }
            }
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
    const selfScoreToggle = document.getElementById('self-score-toggle');
    const backToPlayersBtn = document.getElementById('back-to-players-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    
    // Mode selection
    mode301Btn.addEventListener('click', () => {
        if (isInRoom() && !isHosting) return; // Only host can change
        setGameMode(301);
        updateModeButtons();
        if (isInRoom()) broadcastState(getRawGameState());
    });
    
    mode501Btn.addEventListener('click', () => {
        if (isInRoom() && !isHosting) return; // Only host can change
        setGameMode(501);
        updateModeButtons();
        if (isInRoom()) broadcastState(getRawGameState());
    });
    
    // Double out toggle
    doubleOutToggle.addEventListener('click', () => {
        if (isInRoom() && !isHosting) return; // Only host can change
        const currentState = doubleOutToggle.dataset.enabled === 'true';
        setDoubleOut(!currentState);
        updateDoubleOutToggle();
        if (isInRoom()) broadcastState(getRawGameState());
    });
    
    // Mental math toggle
    mentalMathToggle.addEventListener('click', () => {
        if (isInRoom() && !isHosting) return; // Only host can change
        const currentState = mentalMathToggle.dataset.enabled === 'true';
        setMentalMathMode(!currentState);
        updateMentalMathToggle();
        if (isInRoom()) broadcastState(getRawGameState());
    });
    
    // Self score only toggle
    selfScoreToggle.addEventListener('click', () => {
        if (isInRoom() && !isHosting) return; // Only host can change
        const currentState = selfScoreToggle.dataset.enabled === 'true';
        setSelfScoreOnly(!currentState);
        updateSelfScoreToggle();
        if (isInRoom()) broadcastState(getRawGameState());
    });
    
    // Navigation
    backToPlayersBtn.addEventListener('click', () => {
        showScreen('player-setup');
    });
    
    startGameBtn.addEventListener('click', () => {
        if (isInRoom() && !isHosting) return; // Only host can start
        if (startGame()) {
            // Initialize turn tracking - first player starts
            previousPlayerIndex = 0;
            // Notify if the local profile player starts first
            if (isMyTurn()) {
                vibratePhone(300);
                setTimeout(() => showGameMessage("It's your turn!", 'text-emerald-400'), 100);
            }
            setupBoard();
            showScreen('game-play');
            // Broadcast game start
            if (isInRoom()) broadcastState(getRawGameState());
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

function updateSelfScoreToggle() {
    const toggle = document.getElementById('self-score-toggle');
    if (!toggle) return;
    const knob = toggle.querySelector('span');
    const enabled = isSelfScoreOnly();
    
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

function updateHostOnlyControls() {
    const mode301Btn = document.getElementById('mode-301-btn');
    const mode501Btn = document.getElementById('mode-501-btn');
    const doubleOutToggle = document.getElementById('double-out-toggle');
    const mentalMathToggle = document.getElementById('mental-math-toggle');
    const selfScoreToggle = document.getElementById('self-score-toggle');
    const startGameBtn = document.getElementById('start-game-btn');
    
    // Check if user can control settings (not in room, or is host)
    const canControl = !isInRoom() || isHosting;
    
    // Update button states
    const controls = [mode301Btn, mode501Btn, doubleOutToggle, mentalMathToggle, selfScoreToggle];
    controls.forEach(ctrl => {
        if (ctrl) {
            if (canControl) {
                ctrl.disabled = false;
                ctrl.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                ctrl.disabled = true;
                ctrl.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    });
    
    // Update start button
    if (startGameBtn) {
        if (canControl) {
            startGameBtn.disabled = false;
            startGameBtn.textContent = 'Start';
            startGameBtn.classList.remove('bg-slate-600');
            startGameBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
        } else {
            startGameBtn.disabled = true;
            startGameBtn.textContent = 'Waiting for host...';
            startGameBtn.classList.add('bg-slate-600');
            startGameBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-400');
        }
    }
}

function renderPlayerOrderList() {
    const listContainer = document.getElementById('player-order-list');
    const players = getPlayers();
    const localProfile = getProfile();
    
    listContainer.innerHTML = players.map((player, index) => {
        const isProfile = player.isProfilePlayer;
        const isLocalProfile = isProfile && localProfile && player.name === localProfile.name;
        const badgeClass = isProfile 
            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900' 
            : 'bg-slate-600 text-white';
        
        // Determine label: "You" for local profile, "Player" for remote profiles, "Guest" for guests
        let labelHtml;
        if (isLocalProfile) {
            labelHtml = '<span class="text-xs text-amber-400/70">You</span>';
        } else if (isProfile) {
            labelHtml = '<span class="text-xs text-emerald-400/70">Player</span>';
        } else {
            labelHtml = '<span class="text-xs text-slate-500">Guest</span>';
        }
        
        return `
            <div class="flex items-center gap-2 p-3 ${isProfile ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800/60 border-slate-700/50'} rounded-xl border group hover:border-slate-600 transition-all">
                <span class="w-7 h-7 flex items-center justify-center ${badgeClass} font-bold rounded-md text-xs shadow">
                    ${index + 1}
                </span>
                <span class="flex-1 text-white font-medium truncate text-sm">${escapeHtml(player.name)}</span>
                ${labelHtml}
                <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button class="order-move-up-btn w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-all text-sm ${index === 0 ? 'invisible' : ''}" data-index="${index}">
                        ↑
                    </button>
                    <button class="order-move-down-btn w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-all text-sm ${index === players.length - 1 ? 'invisible' : ''}" data-index="${index}">
                        ↓
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    listContainer.querySelectorAll('.order-move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (movePlayer(index, index - 1)) {
                renderPlayerOrderList();
                // Broadcast if in room
                if (isInRoom()) {
                    broadcastState(getRawGameState());
                }
            }
        });
    });
    
    listContainer.querySelectorAll('.order-move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (movePlayer(index, index + 1)) {
                renderPlayerOrderList();
                // Broadcast if in room
                if (isInRoom()) {
                    broadcastState(getRawGameState());
                }
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
    
    // Check if self-score-only mode is enabled
    if (isSelfScoreOnly()) {
        const currentPlayer = getCurrentPlayer();
        const localProfile = getProfile();
        
        // If current player is a profile player, only their device can log throws
        if (currentPlayer && currentPlayer.isProfilePlayer) {
            const isMyTurnToScore = localProfile && currentPlayer.name === localProfile.name;
            if (!isMyTurnToScore) {
                showGameMessage('Wait for your turn!', 'text-amber-400');
                return;
            }
        }
        // Guests can be scored by anyone
    }
    
    const result = addThrow(throwData.text, throwData.value, throwData.isDouble);
    
    if (result.success) {
        updateGameUI();
        
        if (result.bust) {
            showGameMessage(result.message, 'text-red-400');
            // Turn changed after bust - check if it's now my turn
            const state = getRawGameState();
            handleTurnChange(state.currentPlayerIndex);
        } else if (result.win) {
            showWinnerModal();
        } else if (result.turnComplete) {
            showGameMessage('Next player', 'text-slate-400');
            // Turn changed after 3 throws - check if it's now my turn
            const state = getRawGameState();
            handleTurnChange(state.currentPlayerIndex);
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
    const settingsVibrateToggle = document.getElementById('settings-vibrate-toggle');
    
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
    
    // Vibrate on turn toggle in settings modal
    settingsVibrateToggle.addEventListener('click', () => {
        vibrateOnTurnEnabled = !vibrateOnTurnEnabled;
        saveVibrationSetting();
        updateSettingsVibrateToggle();
    });
    
    // Host Game Modal
    const hostModal = document.getElementById('host-game-modal');
    const closeHostModal = document.getElementById('close-host-modal');
    const closeHostBtn = document.getElementById('close-host-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const hostDisconnectBtn = document.getElementById('host-disconnect-btn');
    
    closeHostModal.addEventListener('click', () => {
        hostModal.classList.add('hidden');
        hostModal.classList.remove('flex');
    });
    
    closeHostBtn.addEventListener('click', () => {
        hostModal.classList.add('hidden');
        hostModal.classList.remove('flex');
    });
    
    hostModal.addEventListener('click', (e) => {
        if (e.target === hostModal) {
            hostModal.classList.add('hidden');
            hostModal.classList.remove('flex');
        }
    });
    
    createRoomBtn.addEventListener('click', () => {
        isHosting = true;
        const roomCode = generateRoomCode();
        connectToRoom(roomCode, handleSyncedState, handleConnectionChange);
        saveConnectionState(roomCode, true);
        // Broadcast current state immediately after connecting
        setTimeout(() => {
            if (isInRoom()) {
                broadcastState(getRawGameState());
                updateHostModalUI();
            }
        }, 500);
    });
    
    hostDisconnectBtn.addEventListener('click', () => {
        clearConnectionState();
        disconnect();
        updateHostModalUI();
        updateSyncStatusIndicator();
    });
    
    // Join Game Modal
    const joinModal = document.getElementById('join-game-modal');
    const closeJoinModal = document.getElementById('close-join-modal');
    const closeJoinBtn = document.getElementById('close-join-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const joinRoomInput = document.getElementById('join-room-input');
    const joinDisconnectBtn = document.getElementById('join-disconnect-btn');
    
    closeJoinModal.addEventListener('click', () => {
        joinModal.classList.add('hidden');
        joinModal.classList.remove('flex');
    });
    
    closeJoinBtn.addEventListener('click', () => {
        joinModal.classList.add('hidden');
        joinModal.classList.remove('flex');
    });
    
    joinModal.addEventListener('click', (e) => {
        if (e.target === joinModal) {
            joinModal.classList.add('hidden');
            joinModal.classList.remove('flex');
        }
    });
    
    joinRoomBtn.addEventListener('click', () => {
        const code = joinRoomInput.value.trim().toUpperCase();
        if (code.length !== 6) {
            showJoinError('Please enter a 6-character code');
            return;
        }
        // Mark that we're joining (not hosting)
        isHosting = false;
        connectToRoom(code, handleSyncedState, handleConnectionChange);
        saveConnectionState(code, false);
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
    
    joinDisconnectBtn.addEventListener('click', () => {
        clearConnectionState();
        disconnect();
        updateJoinModalUI();
        updateSyncStatusIndicator();
    });
    
    // Create Profile Modal
    const createProfileModal = document.getElementById('create-profile-modal');
    const closeCreateProfileModal = document.getElementById('close-create-profile-modal');
    const createProfileNameInput = document.getElementById('create-profile-name-input');
    const confirmCreateProfileBtn = document.getElementById('confirm-create-profile-btn');
    
    closeCreateProfileModal.addEventListener('click', () => {
        createProfileModal.classList.add('hidden');
        createProfileModal.classList.remove('flex');
    });
    
    createProfileModal.addEventListener('click', (e) => {
        if (e.target === createProfileModal) {
            createProfileModal.classList.add('hidden');
            createProfileModal.classList.remove('flex');
        }
    });
    
    confirmCreateProfileBtn.addEventListener('click', () => {
        const name = createProfileNameInput.value.trim();
        if (name) {
            createProfile(name);
            createProfileModal.classList.add('hidden');
            createProfileModal.classList.remove('flex');
            createProfileNameInput.value = '';
            profilePlaying = true; // Default to playing when profile is created
            updateProfileSection();
            updateProfilePlayerInGame();
            updateContinueButton();
        }
    });
    
    createProfileNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmCreateProfileBtn.click();
        }
    });
    
    // Edit Profile Modal
    const editProfileModal = document.getElementById('edit-profile-modal');
    const closeEditProfileModal = document.getElementById('close-edit-profile-modal');
    const editProfileNameInput = document.getElementById('edit-profile-name-input');
    const saveProfileNameBtn = document.getElementById('save-profile-name-btn');
    const deleteProfileBtn = document.getElementById('delete-profile-btn');
    
    closeEditProfileModal.addEventListener('click', () => {
        editProfileModal.classList.add('hidden');
        editProfileModal.classList.remove('flex');
    });
    
    editProfileModal.addEventListener('click', (e) => {
        if (e.target === editProfileModal) {
            editProfileModal.classList.add('hidden');
            editProfileModal.classList.remove('flex');
        }
    });
    
    saveProfileNameBtn.addEventListener('click', () => {
        const newName = editProfileNameInput.value.trim();
        if (newName) {
            updateProfileName(newName);
            updateProfileSection();
            // Also update if profile player is in game
            if (isProfilePlayerInGame()) {
                const players = getPlayers();
                const profileIndex = players.findIndex(p => p.isProfilePlayer);
                if (profileIndex >= 0) {
                    updatePlayer(profileIndex, newName);
                }
            }
        }
    });
    
    deleteProfileBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete your profile? This cannot be undone.')) {
            // Remove profile player from game first
            if (isProfilePlayerInGame()) {
                removeProfilePlayer();
            }
            deleteProfile();
            editProfileModal.classList.add('hidden');
            editProfileModal.classList.remove('flex');
            profilePlaying = true; // Reset for next profile
            updateProfileSection();
            renderPlayerList();
            updateContinueButton();
        }
    });
}

function openCreateProfileModal() {
    const modal = document.getElementById('create-profile-modal');
    const input = document.getElementById('create-profile-name-input');
    input.value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => input.focus(), 100);
}

function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    const input = document.getElementById('edit-profile-name-input');
    const profile = getProfile();
    
    if (profile) {
        input.value = profile.name;
        
        // Update stats display
        const stats = profile.stats;
        const winRate = stats.gamesPlayed > 0 ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(0) : 0;
        const avgPerDart = stats.totalDarts > 0 ? (stats.totalPoints / stats.totalDarts).toFixed(1) : 0;
        
        document.getElementById('profile-stat-games').textContent = stats.gamesPlayed;
        document.getElementById('profile-stat-wins').textContent = stats.gamesWon;
        document.getElementById('profile-stat-winrate').textContent = `${winRate}%`;
        document.getElementById('profile-stat-darts').textContent = stats.totalDarts;
        document.getElementById('profile-stat-avg').textContent = avgPerDart;
        document.getElementById('profile-stat-100plus').textContent = stats.hundredPlusCount;
        document.getElementById('profile-stat-best').textContent = stats.bestAvgPerTurn.toFixed(1);
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function openNewGameModal() {
    const modal = document.getElementById('new-game-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Track if we're hosting or joining
let isHosting = true;

// Save connection state to sessionStorage
function saveConnectionState(roomCode, hosting) {
    sessionStorage.setItem('dartsRoomCode', roomCode);
    sessionStorage.setItem('dartsIsHosting', String(hosting));
}

// Clear connection state from sessionStorage
function clearConnectionState() {
    sessionStorage.removeItem('dartsRoomCode');
    sessionStorage.removeItem('dartsIsHosting');
}

// Restore connection from sessionStorage (called on page load)
function restoreConnection() {
    const savedRoomCode = sessionStorage.getItem('dartsRoomCode');
    const savedIsHosting = sessionStorage.getItem('dartsIsHosting');
    
    if (savedRoomCode) {
        isHosting = savedIsHosting === 'true';
        
        // Set pending profile add for joiners
        if (!isHosting && hasProfile() && profilePlaying) {
            pendingProfileAdd = true;
        }
        
        connectToRoom(savedRoomCode, handleSyncedState, handleConnectionChange);
    }
}

function openHostModal() {
    const modal = document.getElementById('host-game-modal');
    updateHostModalUI();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function openJoinModal() {
    const modal = document.getElementById('join-game-modal');
    updateJoinModalUI();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function updateHostModalUI() {
    const notConnected = document.getElementById('host-not-connected');
    const connectedStatus = document.getElementById('host-connected-status');
    const roomCode = document.getElementById('host-room-code');
    
    if (isInRoom() && isHosting) {
        notConnected.classList.add('hidden');
        connectedStatus.classList.remove('hidden');
        roomCode.textContent = getRoomCode();
    } else {
        notConnected.classList.remove('hidden');
        connectedStatus.classList.add('hidden');
    }
}

function updateJoinModalUI() {
    const notConnected = document.getElementById('join-not-connected');
    const connectedStatus = document.getElementById('join-connected-status');
    const roomCode = document.getElementById('join-room-code');
    const joinError = document.getElementById('join-error');
    
    // Clear any previous errors
    joinError.classList.add('hidden');
    
    if (isInRoom() && !isHosting) {
        notConnected.classList.add('hidden');
        connectedStatus.classList.remove('hidden');
        roomCode.textContent = getRoomCode();
    } else {
        notConnected.classList.remove('hidden');
        connectedStatus.classList.add('hidden');
    }
}

function handleSyncedState(state) {
    // Apply the synced state and update UI
    applySyncedState(state, () => {
        // If we have a pending profile add (joiner just connected), add it now
        if (pendingProfileAdd) {
            pendingProfileAdd = false;
            if (hasProfile() && !isProfilePlayerInGame() && profilePlaying) {
                addProfilePlayer();
                // Broadcast updated state with our profile player added
                if (isInRoom()) {
                    broadcastState(getRawGameState());
                }
            }
        }
        
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
            
            // Check for turn changes and vibrate if it's now my turn
            handleTurnChange(state.currentPlayerIndex);
        } else {
            // In lobby/setup phase - show player setup
            // Update player lists based on current screen
            if (currentScreen === 'player-setup') {
                updateProfileSection();
                renderPlayerList();
                updateContinueButton();
            } else if (currentScreen === 'game-setup') {
                updateModeButtons();
                updateDoubleOutToggle();
                updateMentalMathToggle();
                updateSelfScoreToggle();
                updateHostOnlyControls();
                renderPlayerOrderList();
            } else if (currentScreen === 'game-play') {
                // Game was reset, go back to setup
                showScreen('player-setup');
            }
            // Reset turn tracking when not in game
            previousPlayerIndex = null;
        }
    });
}

function handleConnectionChange(status) {
    updateHostModalUI();
    updateJoinModalUI();
    updateSyncStatusIndicator();
    
    if (status.error) {
        clearConnectionState();
        showJoinError('Failed to connect. Please try again.');
    }
    
    // Clear saved state if disconnected
    if (!status.connected && !status.error) {
        clearConnectionState();
    }
    
    // When successfully joining a room, set flag to add profile player after receiving state
    if (status.connected && !isHosting) {
        // Close the join modal
        const joinModal = document.getElementById('join-game-modal');
        joinModal.classList.add('hidden');
        joinModal.classList.remove('flex');
        
        // Set flag to add profile player after receiving initial state
        if (hasProfile() && profilePlaying) {
            pendingProfileAdd = true;
        }
        
        // Navigate to player setup screen
        showScreen('player-setup');
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
    
    // Also update the lobby status bar
    updateLobbyStatus();
}

function updateLobbyStatus() {
    const lobbyStatus = document.getElementById('lobby-status');
    const lobbyStatusText = document.getElementById('lobby-status-text');
    const lobbyRoomCode = document.getElementById('lobby-room-code');
    
    if (!lobbyStatus) return;
    
    if (isInRoom()) {
        lobbyStatus.classList.remove('hidden');
        lobbyRoomCode.textContent = getRoomCode();
        
        if (isHosting) {
            lobbyStatus.className = 'mb-4 p-3 rounded-xl border bg-amber-500/10 border-amber-500/30';
            lobbyStatusText.textContent = 'Hosting';
            lobbyStatusText.className = 'text-sm text-amber-300';
        } else {
            lobbyStatus.className = 'mb-4 p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30';
            lobbyStatusText.textContent = 'Connected';
            lobbyStatusText.className = 'text-sm text-emerald-300';
        }
    } else {
        lobbyStatus.classList.add('hidden');
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
    
    // Update toggle states
    updateSettingsMentalMathToggle();
    updateSettingsVibrateToggle();
    
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

function updateSettingsVibrateToggle() {
    const toggle = document.getElementById('settings-vibrate-toggle');
    if (!toggle) return;
    const knob = toggle.querySelector('span');
    
    toggle.dataset.enabled = String(vibrateOnTurnEnabled);
    
    if (vibrateOnTurnEnabled) {
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
