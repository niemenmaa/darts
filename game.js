let settings = {
    round: 0,
    noOuts: [169,168,166,165,163,162,159],
    max: 170,
    min: 2,
}

let sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Game state
let currentTarget = 0;
let originalTarget = 0;
let remainingDarts = 3;
let gameStatus = null; // null, 'win', or 'lose'
let gameHistory = []; // Array of { result, time, throws, target }
let gameStartTime = null;
let throwsUsed = 0;
let timerInterval = null;

export { settings, sectors, buildBoard, clickSector, slideOutSector, slideInSector, resetActiveSector, getActiveSelection, showScore, getDistanceFromCenter, INTERACTIVE_ZONE_MIN, generateTarget, handleThrow, getGameState };

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
    
    if (targetDisplay) {
        targetDisplay.textContent = currentTarget;
    }
    
    if (dartsDisplay) {
        dartsDisplay.textContent = '🎯'.repeat(remainingDarts);
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

// Handle a throw - returns { text, value, isDouble }
function handleThrow(selection) {
    if (!selection) return;
    
    const { text, value } = selection;
    const isDouble = text.startsWith('D') || value === 50; // D prefix or bull (50 counts as double)
    
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

function buildBoard(sectors) {
    const totalSectors = sectors.length;
    const sectorAngle = 360 / totalSectors; // 18° per sector

    let board = document.createElement('div');
    board.id = 'board';
    board.className = 'relative w-full aspect-square rounded-full mx-auto overflow-hidden';

    sectors.forEach((score, index) => {
        const sectorElement = document.createElement('div');
        sectorElement.dataset.score = score;
        const rotation = index * sectorAngle; // Start at top (20)
        const isEven = index % 2 === 0;

        // Calculate symmetric wedge polygon (full 18° sector)
        const halfAngle = sectorAngle / 2;
        const rad = (halfAngle * Math.PI) / 180;
        const xOffset = 50 * Math.tan(rad);
        const leftX = 50 - xOffset;
        const rightX = 50 + xOffset;

        // Traditional dartboard colors: black sectors get red rings, white sectors get green rings
        const baseColor = isEven ? '#1a1a1a' : '#f5f5dc';
        const ringColor = isEven ? '#dc2626' : '#16a34a'; // red-600 / green-600
        
        // Radial gradient for double (outer) and triple (inner) rings
        // Using closest-side so 100% = edge of visible wedge
        // Inner area (0-53%) is heavily dimmed to indicate it's disabled
        const veryDimmed = isEven ? 'rgba(10,10,10,0.7)' : 'rgba(100,100,80,0.7)';
        const gradient = `radial-gradient(circle closest-side at 50% 50%, 
            ${veryDimmed} 0%, 
            ${veryDimmed} 53%, 
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

        // Label with counter-rotation to keep text readable
        const label = document.createElement('span');
        label.className = 'mt-4 text-xs font-bold select-none';
        label.style.cssText = `
            transform: rotate(${-rotation}deg);
            color: ${isEven ? '#f5f5dc' : '#1a1a1a'};
        `;
        label.textContent = score;

        sectorElement.appendChild(label);
        sectorElement.dataset.score = score;
        sectorElement.dataset.originalBg = gradient;
        sectorElement.dataset.originalColor = isEven ? '#f5f5dc' : '#1a1a1a';
        board.appendChild(sectorElement);
    });

    // Center bullseye
    const bullseye = document.createElement('div');
    bullseye.className = 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-red-600 border-4 border-green-700 z-20 cursor-pointer hover:scale-110 transition-transform';
    bullseye.dataset.score = 50;
    board.appendChild(bullseye);

    return board;
}

// Grid-based input
let activeModifier = null; // null, 'triple', or 'double'

function buildGrid() {
    const grid = document.createElement('div');
    grid.id = 'grid';
    grid.className = 'flex gap-2 w-full';

    // Modifier column (D over T on left side)
    const modifierCol = document.createElement('div');
    modifierCol.className = 'flex flex-col gap-1.5';

    const doubleBtn = document.createElement('button');
    doubleBtn.id = 'modifier-double';
    doubleBtn.className = 'w-12 flex-1 rounded-lg font-bold text-2xl bg-green-600 text-white hover:bg-green-500 transition-all';
    doubleBtn.textContent = 'D';
    doubleBtn.dataset.modifier = 'double';

    const tripleBtn = document.createElement('button');
    tripleBtn.id = 'modifier-triple';
    tripleBtn.className = 'w-12 flex-1 rounded-lg font-bold text-2xl bg-red-600 text-white hover:bg-red-500 transition-all';
    tripleBtn.textContent = 'T';
    tripleBtn.dataset.modifier = 'triple';

    modifierCol.appendChild(doubleBtn);
    modifierCol.appendChild(tripleBtn);
    grid.appendChild(modifierCol);

    // Right side container (numbers + bulls)
    const rightContainer = document.createElement('div');
    rightContainer.className = 'flex flex-col gap-1.5 flex-1';

    // Number grid (4 rows x 5 columns, numbers 1-20)
    const numbersContainer = document.createElement('div');
    numbersContainer.className = 'grid grid-cols-5 gap-1.5';

    for (let i = 1; i <= 20; i++) {
        const btn = document.createElement('button');
        const sectorIndex = sectors.indexOf(i);
        const isEven = sectorIndex % 2 === 0;
        
        // Even index in sectors = black bg, odd index = white bg
        const bgColor = isEven ? 'bg-neutral-900' : 'bg-neutral-100';
        const textColor = isEven ? 'text-white' : 'text-black';
        const hoverBg = isEven ? 'hover:bg-neutral-700' : 'hover:bg-neutral-300';
        
        btn.className = `h-12 rounded-lg font-bold text-xl ${bgColor} ${textColor} ${hoverBg} transition-all`;
        btn.textContent = i;
        btn.dataset.number = i;
        numbersContainer.appendChild(btn);
    }
    rightContainer.appendChild(numbersContainer);

    // Bull row (25 and 50)
    const bullRow = document.createElement('div');
    bullRow.className = 'flex justify-center gap-1.5';

    const bull25 = document.createElement('button');
    bull25.className = 'flex-1 h-12 rounded-lg font-bold text-xl bg-green-700 text-white hover:bg-green-600 transition-all';
    bull25.textContent = '25';
    bull25.dataset.number = 25;
    bull25.dataset.isBull = 'true';

    const bull50 = document.createElement('button');
    bull50.className = 'flex-1 h-12 rounded-lg font-bold text-xl bg-red-600 text-white hover:bg-red-500 transition-all';
    bull50.textContent = '50';
    bull50.dataset.number = 50;
    bull50.dataset.isBull = 'true';

    bullRow.appendChild(bull25);
    bullRow.appendChild(bull50);
    rightContainer.appendChild(bullRow);

    grid.appendChild(rightContainer);

    return grid;
}

function handleModifierClick(type) {
    const tripleBtn = document.getElementById('modifier-triple');
    const doubleBtn = document.getElementById('modifier-double');
    
    // Toggle off if same modifier clicked
    if (activeModifier === type) {
        activeModifier = null;
        tripleBtn.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
        doubleBtn.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
        return;
    }
    
    // Set new modifier
    activeModifier = type;
    
    // Update visual feedback
    tripleBtn.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
    doubleBtn.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
    
    if (type === 'triple') {
        tripleBtn.classList.add('ring-4', 'ring-yellow-400', 'scale-110');
    } else if (type === 'double') {
        doubleBtn.classList.add('ring-4', 'ring-yellow-400', 'scale-110');
    }
}

function handleGridNumberClick(number) {
    const num = parseInt(number);
    const isBull = num === 25 || num === 50;
    
    let text, value;
    
    if (isBull) {
        // Bulls don't use modifiers
        text = String(num);
        value = num;
    } else if (activeModifier === 'triple') {
        text = `T${num}`;
        value = num * 3;
    } else if (activeModifier === 'double') {
        text = `D${num}`;
        value = num * 2;
    } else {
        text = String(num);
        value = num;
    }
    
    showScore(text);
    
    // Reset modifier after use
    resetModifier();
    
    return { text, value };
}

function resetModifier() {
    activeModifier = null;
    const tripleBtn = document.getElementById('modifier-triple');
    const doubleBtn = document.getElementById('modifier-double');
    if (tripleBtn) tripleBtn.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
    if (doubleBtn) doubleBtn.classList.remove('ring-4', 'ring-yellow-400', 'scale-110');
}

function clickSector(event) {
    const score = event.target.dataset.score;
    console.log(score);
}

// Calculate distance from board center as percentage (0 = center, 100 = edge)
function getDistanceFromCenter(event) {
    const board = document.getElementById('board');
    if (!board) return 0;
    
    const rect = board.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    
    // Get touch or mouse coordinates
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return (distance / radius) * 100;
}

// Interactive zone: 53% (triple ring start) to 100% (edge)
const INTERACTIVE_ZONE_MIN = 53;

let activeSector = null;

function getActiveSelection() {
    if (!activeSector) return null;
    const score = activeSector.dataset.score;
    const mode = activeSector.dataset.mode;
    if (mode === 'outerBull') return { text: '25', value: 25 };
    if (mode === 'double') return { text: `D${score}`, value: parseInt(score) * 2 };
    if (mode === 'triple') return { text: `T${score}`, value: parseInt(score) * 3 };
    return { text: score, value: parseInt(score) };
}

function showScore(text) {
    const display = document.getElementById('score-display');
    if (display) {
        display.textContent = text;
        display.classList.add('scale-110');
        setTimeout(() => display.classList.remove('scale-110'), 150);
    }
}

function resetActiveSector() {
    if (activeSector) {
        resetSector(activeSector);
        activeSector = null;
    }
}

function resetSector(sector) {
    if (!sector || !sector.dataset.score) return;
    const label = sector.querySelector('span');
    if (label) {
        label.textContent = sector.dataset.score;
        label.style.color = sector.dataset.originalColor;
    }
    sector.style.background = sector.dataset.originalBg;
    sector.dataset.mode = '';
}

function slideOutSector(event) {
    const sector = event.target.closest('[data-score]');
    if (!sector) return;
    
    // Handle bullseye first - always allowed
    if (sector.dataset.score === '50') {
        // Reset previous sector if different
        if (activeSector && activeSector !== sector) {
            resetSector(activeSector);
        }
        sector.dataset.mode = 'outerBull';
        activeSector = sector;
        console.log('25');
        return;
    }
    
    // Check if touch is in interactive zone (triple ring to edge)
    const distance = getDistanceFromCenter(event);
    if (distance < INTERACTIVE_ZONE_MIN) {
        // Touch is in dead zone (between bull and triple ring)
        return;
    }
    
    // Reset previous sector if different
    if (activeSector && activeSector !== sector) {
        resetSector(activeSector);
    }
    
    if (!sector.dataset.originalBg) return;
    
    const score = sector.dataset.score;
    const label = sector.querySelector('span');
    if (!label) return;
    
    // Apply double (D) style - red/green alternating
    const index = sectors.indexOf(parseInt(score));
    const isEven = index % 2 === 0;
    
    sector.style.background = isEven ? '#dc2626' : '#16a34a'; // red-600 / green-600
    label.textContent = `D${score}`;
    label.style.color = '#ffffff';
    sector.dataset.mode = 'double';
    activeSector = sector;
    
    console.log(`D${score}`);
}

function slideInSector(event) {
    const sector = event.target.closest('[data-score]');
    if (!sector || !sector.dataset.originalBg) return; // Skip bullseye
    
    // Check if touch is in interactive zone (triple ring to edge)
    const distance = getDistanceFromCenter(event);
    if (distance < INTERACTIVE_ZONE_MIN) {
        // Touch is in dead zone (between bull and triple ring)
        return;
    }
    
    const score = sector.dataset.score;
    const label = sector.querySelector('span');
    if (!label) return;
    
    // Reset previous sector if different
    if (activeSector && activeSector !== sector) {
        resetSector(activeSector);
    }
    
    // Apply triple (T) style - orange/blue alternating
    const index = sectors.indexOf(parseInt(score));
    const isEven = index % 2 === 0;
    
    sector.style.background = isEven ? '#dc2626' : '#16a34a'; // red-600 / green-600
    label.textContent = `T${score}`;
    label.style.color = '#ffffff';
    sector.dataset.mode = 'triple';
    activeSector = sector;
    
    console.log(`T${score}`);
}