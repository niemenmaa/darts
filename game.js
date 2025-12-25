import { getCookie, setCookie } from './cookie.js';
import { 
    sectors, 
    buildBoard, 
    getDistanceFromCenter, 
    INTERACTIVE_ZONE_MIN, 
    getActiveSelection, 
    showScore, 
    resetActiveSector, 
    slideOutSector, 
    slideInSector 
} from './board.js';

let settings = {
    round: 0,
    noOuts: [169,168,166,165,163,162,159],
    max: 170,
    min: 2,
    mentalMathMode: false,
    ringAccuracy: 100,    // % chance T/D hits the ring (miss = single)
    sectorAccuracy: 100,  // % chance throw stays in sector (miss = neighbor)
}

// Load settings from cookie
function loadSettings() {
    const saved = getCookie();
    if (saved) {
        settings.min = saved.min ?? 2;
        settings.max = saved.max ?? 170;
        settings.mentalMathMode = saved.mentalMathMode ?? false;
        settings.ringAccuracy = saved.ringAccuracy ?? 100;
        settings.sectorAccuracy = saved.sectorAccuracy ?? 100;
    }
}

// Save settings to cookie
function saveSettings() {
    setCookie({
        min: settings.min,
        max: settings.max,
        mentalMathMode: settings.mentalMathMode,
        ringAccuracy: settings.ringAccuracy,
        sectorAccuracy: settings.sectorAccuracy
    });
}

// Update settings from UI
function updateSettings(newSettings) {
    if (newSettings.min !== undefined) settings.min = Math.max(2, Math.min(170, newSettings.min));
    if (newSettings.max !== undefined) settings.max = Math.max(2, Math.min(170, newSettings.max));
    if (newSettings.mentalMathMode !== undefined) settings.mentalMathMode = newSettings.mentalMathMode;
    if (newSettings.ringAccuracy !== undefined) settings.ringAccuracy = Math.max(0, Math.min(100, newSettings.ringAccuracy));
    if (newSettings.sectorAccuracy !== undefined) settings.sectorAccuracy = Math.max(0, Math.min(100, newSettings.sectorAccuracy));
    
    // Ensure min <= max
    if (settings.min > settings.max) {
        [settings.min, settings.max] = [settings.max, settings.min];
    }
    
    saveSettings();
}

// Initialize settings on load
loadSettings();

// Game state
let currentTarget = 0;
let originalTarget = 0;
let remainingDarts = 3;
let gameStatus = null; // null, 'win', or 'lose'
let gameHistory = []; // Array of { result, time, throws, target }
let gameStartTime = null;
let throwsUsed = 0;
let timerInterval = null;
let currentRoundThrows = []; // Array of throw results for current round

// Re-export board utilities along with game-specific functions
export { 
    settings, 
    sectors, 
    buildBoard, 
    slideOutSector, 
    slideInSector, 
    resetActiveSector, 
    getActiveSelection, 
    showScore, 
    getDistanceFromCenter, 
    INTERACTIVE_ZONE_MIN, 
    generateTarget, 
    handleThrow, 
    getGameState, 
    updateSettings, 
    applyMissChance, 
    clearBoardMarkers 
};

// Apply miss chance to a selection
// Returns { original, actual, wasMiss, missType }
function applyMissChance(selection) {
    if (!selection) return null;
    
    const original = { ...selection };
    let actual = { ...selection };
    let wasMiss = false;
    let missType = null;
    
    // Parse the throw type
    const isTriple = selection.text.startsWith('T');
    const isDouble = selection.text.startsWith('D') || selection.value === 50;
    const isBull = selection.value === 25 || selection.value === 50;
    const isBull50 = selection.value === 50;
    const isBull25 = selection.value === 25;
    
    // Get the base number
    let baseNumber;
    if (isBull) {
        baseNumber = selection.value; // 25 or 50
    } else if (isTriple || isDouble) {
        baseNumber = parseInt(selection.text.substring(1));
    } else {
        baseNumber = selection.value;
    }
    
    // Handle bull accuracy separately
    if (isBull) {
        // Bull 50 (inner bull / bullseye)
        if (isBull50) {
            // First check sector accuracy - miss = go to random sector (single)
            if (settings.sectorAccuracy < 100) {
                const sectorRoll = Math.random() * 100;
                if (sectorRoll >= settings.sectorAccuracy) {
                    // Miss to random sector (single)
                    const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
                    actual.text = String(randomSector);
                    actual.value = randomSector;
                    wasMiss = true;
                    missType = 'sector';
                    return { original, actual, wasMiss, missType };
                }
            }
            // If sector was hit, check ring accuracy - miss = becomes 25
            if (settings.ringAccuracy < 100) {
                const ringRoll = Math.random() * 100;
                if (ringRoll >= settings.ringAccuracy) {
                    actual.text = '25';
                    actual.value = 25;
                    wasMiss = true;
                    missType = 'ring';
                }
            }
        }
        // 25 (outer bull)
        else if (isBull25) {
            // Check sector accuracy - miss = go to random sector OR rarely bull
            if (settings.sectorAccuracy < 100) {
                const sectorRoll = Math.random() * 100;
                if (sectorRoll >= settings.sectorAccuracy) {
                    wasMiss = true;
                    missType = 'sector';
                    // 15% chance to hit bull 50 instead, 85% chance to hit random sector
                    if (Math.random() < 0.15) {
                        actual.text = '50';
                        actual.value = 50;
                    } else {
                        const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
                        actual.text = String(randomSector);
                        actual.value = randomSector;
                    }
                }
            }
        }
        return { original, actual, wasMiss, missType };
    }
    
    // Step 1: Check sector accuracy (miss = go to neighbor)
    if (settings.sectorAccuracy < 100) {
        const roll = Math.random() * 100;
        if (roll >= settings.sectorAccuracy) {
            // Miss sector - go to random neighbor
            const sectorIndex = sectors.indexOf(baseNumber);
            const goLeft = Math.random() < 0.5;
            const neighborIndex = goLeft 
                ? (sectorIndex - 1 + sectors.length) % sectors.length
                : (sectorIndex + 1) % sectors.length;
            baseNumber = sectors[neighborIndex];
            wasMiss = true;
            missType = 'sector';
        }
    }
    
    // Step 2: Check ring accuracy for T/D throws (miss = becomes single)
    if ((isTriple || isDouble) && settings.ringAccuracy < 100) {
        const roll = Math.random() * 100;
        if (roll >= settings.ringAccuracy) {
            // Miss ring - becomes single
            actual.text = String(baseNumber);
            actual.value = baseNumber;
            wasMiss = true;
            missType = missType ? 'both' : 'ring';
        } else {
            // Hit the ring with potentially new sector
            if (isTriple) {
                actual.text = `T${baseNumber}`;
                actual.value = baseNumber * 3;
            } else {
                actual.text = `D${baseNumber}`;
                actual.value = baseNumber * 2;
            }
        }
    } else if (!isTriple && !isDouble) {
        // Single throw - just update if sector changed
        actual.text = String(baseNumber);
        actual.value = baseNumber;
    } else {
        // T/D with sector change but ring hit
        if (isTriple) {
            actual.text = `T${baseNumber}`;
            actual.value = baseNumber * 3;
        } else {
            actual.text = `D${baseNumber}`;
            actual.value = baseNumber * 2;
        }
    }
    
    return { original, actual, wasMiss, missType };
}

// Add a marker to the board showing where a dart landed
function addBoardMarker(score, wasMiss) {
    const board = document.getElementById('board');
    if (!board) return;
    
    // Check if it's a bull hit (score is a string like "25" or "50")
    const isBull = score === '25' || score === '50';
    
    // Find the sector element
    const sectorElements = board.querySelectorAll('[data-score]');
    let targetSector = null;
    
    // Handle bullseye
    if (isBull) {
        targetSector = board.querySelector('[data-score="50"]');
    } else {
        // Find sector by base number
        const baseNum = parseInt(String(score).replace(/[TD]/g, ''));
        for (const sector of sectorElements) {
            if (parseInt(sector.dataset.score) === baseNum && sector.dataset.score !== '50') {
                targetSector = sector;
                break;
            }
        }
    }
    
    if (!targetSector) return;
    
    // Create marker element
    const marker = document.createElement('div');
    marker.className = `dart-marker absolute w-3 h-3 rounded-full z-30 pointer-events-none ${wasMiss ? 'bg-yellow-400' : 'bg-white'} border-2 ${wasMiss ? 'border-yellow-600' : 'border-slate-600'}`;
    
    // Position marker
    if (isBull) {
        // Bullseye - position near center with slight offset for each dart
        const dartIndex = currentRoundThrows.length - 1;
        // Arrange in a small triangle pattern around center
        const offsets = [
            { x: 0, y: 0 },      // First dart: center
            { x: -6, y: 4 },     // Second dart: bottom-left
            { x: 6, y: 4 }       // Third dart: bottom-right
        ];
        const offset = offsets[dartIndex] || { x: 0, y: 0 };
        marker.style.cssText = `top: 50%; left: 50%; transform: translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px));`;
    } else {
        // Sector - position in the visible area (outer ring area)
        const sectorIndex = sectors.indexOf(parseInt(targetSector.dataset.score));
        const sectorAngle = 360 / sectors.length;
        const angle = (sectorIndex * sectorAngle - 90) * Math.PI / 180; // -90 to start at top
        const radius = 38 + (currentRoundThrows.length * 3); // Position in outer area
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        marker.style.cssText = `top: ${y}%; left: ${x}%; transform: translate(-50%, -50%);`;
    }
    
    board.appendChild(marker);
}

// Clear all dart markers from board
function clearBoardMarkers() {
    const board = document.getElementById('board');
    if (!board) return;
    board.querySelectorAll('.dart-marker').forEach(m => m.remove());
}

// Timer functions
function startTimer() {
    stopTimer();
    gameStartTime = Date.now();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay && gameStartTime) {
        const seconds = Math.floor((Date.now() - gameStartTime) / 1000);
        timerDisplay.textContent = `${seconds}s`;
    }
}

// Generate random target between min and max, excluding noOuts
function generateTarget() {
    let target;
    do {
        target = Math.floor(Math.random() * (settings.max - settings.min + 1)) + settings.min;
    } while (settings.noOuts.includes(target));
    
    currentTarget = target;
    originalTarget = target;
    remainingDarts = 3;
    gameStatus = null;
    throwsUsed = 0;
    currentRoundThrows = [];
    clearBoardMarkers();
    startTimer();
    updateUI();
    return target;
}

function getGameState() {
    return { currentTarget, remainingDarts, gameStatus };
}

// Update UI elements
function updateUI() {
    const targetDisplay = document.getElementById('target-display');
    const dartsDisplay = document.getElementById('darts-display');
    const statusDisplay = document.getElementById('game-status');
    const historyDisplay = document.getElementById('history-display');
    const throwsDisplay = document.getElementById('throws-display');
    
    if (targetDisplay) {
        // In mental math mode, only show the original target
        if (settings.mentalMathMode) {
            targetDisplay.textContent = originalTarget;
        } else {
            targetDisplay.textContent = currentTarget;
        }
    }
    
    if (dartsDisplay) {
        // Show darts with used ones dimmed
        const usedDarts = 3 - remainingDarts;
        let dartsHTML = '';
        for (let i = 0; i < 3; i++) {
            const opacity = i < usedDarts ? 'opacity-30' : '';
            dartsHTML += `<span class="${opacity}">🎯</span>`;
        }
        dartsDisplay.innerHTML = dartsHTML;
    }
    
    if (throwsDisplay) {
        // Show throw results
        throwsDisplay.textContent = currentRoundThrows.map(t => t.text).join(' | ');
    }
    
    if (statusDisplay) {
        if (gameStatus === 'win') {
            statusDisplay.textContent = 'WIN!';
            statusDisplay.className = 'text-3xl font-bold mt-2 h-10 text-green-400';
        } else if (gameStatus === 'lose') {
            statusDisplay.textContent = 'LOSE';
            statusDisplay.className = 'text-3xl font-bold mt-2 h-10 text-red-400';
        } else {
            statusDisplay.textContent = '';
            statusDisplay.className = 'text-3xl font-bold mt-2 h-10';
        }
    }
    
    if (historyDisplay) {
        historyDisplay.innerHTML = gameHistory.map(game => 
            `<div class="flex justify-between items-center px-2 py-1 ${game.result === 'W' ? 'text-green-400' : 'text-red-400'}">
                <span class="font-bold">${game.result === 'W' ? '✓' : '✗'}</span>
                <span>${game.target}</span>
                <span>${game.throws}🎯</span>
                <span>${game.time}s</span>
            </div>`
        ).join('');
    }
}

// Show miss notification
function showMissNotification(original, actual) {
    const notification = document.getElementById('miss-notification');
    if (!notification) return;
    
    notification.textContent = `Missed! ${original.text} → ${actual.text}`;
    notification.style.opacity = '1';
    
    // Fade out after 2 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 2000);
}

// Handle a throw - returns { text, value, isDouble }
function handleThrow(selection) {
    if (!selection) return;
    
    // Apply miss chance
    const missResult = applyMissChance(selection);
    if (!missResult) return;
    
    const { original, actual, wasMiss } = missResult;
    const { text, value } = actual;
    const isDouble = text.startsWith('D') || value === 50; // D prefix or bull (50 counts as double)
    
    // Show miss notification if missed
    if (wasMiss) {
        showMissNotification(original, actual);
    }
    
    // Track throw for display
    currentRoundThrows.push(actual);
    
    // Add marker to board
    addBoardMarker(actual.text, wasMiss);
    
    // Clear win/lose message on first throw of new round
    if (gameStatus !== null) {
        gameStatus = null;
    }
    
    // Track throws
    throwsUsed++;
    
    // Subtract from target
    currentTarget -= value;
    remainingDarts--;
    
    // Helper to record game result
    const recordGame = (result) => {
        stopTimer();
        const timeSeconds = Math.round((Date.now() - gameStartTime) / 1000);
        gameHistory.unshift({ 
            result, 
            time: timeSeconds, 
            throws: throwsUsed,
            target: originalTarget
        });
        // Keep only last 10 games
        if (gameHistory.length > 10) gameHistory.pop();
    };
    
    // Check win/lose conditions
    if (currentTarget === 0) {
        if (isDouble) {
            gameStatus = 'win';
            recordGame('W');
        } else {
            gameStatus = 'lose';
            recordGame('L');
        }
        // Prepare next round
        setTimeout(() => {
            generateTarget();
        }, 1500);
    } else if (currentTarget < 0) {
        gameStatus = 'lose';
        recordGame('L');
        // Prepare next round
        setTimeout(() => {
            generateTarget();
        }, 1500);
    } else if (remainingDarts === 0) {
        gameStatus = 'lose';
        recordGame('L');
        // Prepare next round
        setTimeout(() => {
            generateTarget();
        }, 1500);
    }
    
    updateUI();
    return { text, value, isDouble };
}
