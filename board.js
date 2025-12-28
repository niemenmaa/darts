/**
 * Shared Dartboard Module
 * Contains dartboard rendering and interaction utilities used by both game modes
 */

// Dartboard sectors in clockwise order starting from top (20)
export const sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Interactive zone: 53% (triple ring start) to 100% (edge)
export const INTERACTIVE_ZONE_MIN = 53;

// Ring boundaries (outer edge as % of board radius from center)
// Based on measured ring widths: Bull50=0.14%, Bull25=0.75%, InnerSingle=33%, Triple=5.7%, OuterSingle=51.2%, Double=9.2%
export const RING_BOUNDARIES = {
    BULL_50: 0.14,       // 0-0.14%: Bullseye (50)
    BULL_25: 0.89,       // 0.14-0.89%: Outer Bull (25)
    INNER_SINGLE: 33.89, // 0.89-33.89%: Inner single area
    TRIPLE: 39.59,       // 33.89-39.59%: Triple ring
    OUTER_SINGLE: 90.79, // 39.59-90.79%: Outer single area
    DOUBLE: 100          // 90.79-100%: Double ring
};

// Target center radii (where to aim - middle of each zone)
export const TARGET_RADII = {
    BULL_50: 0.07,   // Center of bullseye (0 + 0.14) / 2
    BULL_25: 0.515,  // Center of outer bull (0.14 + 0.89) / 2
    SINGLE: 65.19,   // Center of outer single area (39.59 + 90.79) / 2
    TRIPLE: 36.74,   // Center of triple ring (33.89 + 39.59) / 2
    DOUBLE: 95.40    // Center of double ring (90.79 + 100) / 2
};

// Sector angle constants
export const SECTOR_ANGLE = 360 / 20; // 18° per sector

// Active sector state
let activeSector = null;

/**
 * Build the dartboard DOM element
 * @returns {HTMLElement} The board element
 */
export function buildBoard() {
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

/**
 * Calculate distance from board center as percentage (0 = center, 100 = edge)
 * @param {Event} event - Mouse or touch event
 * @param {HTMLElement} [board] - Optional board element (defaults to #board)
 * @returns {number} Distance as percentage
 */
export function getDistanceFromCenter(event, board = null) {
    const boardEl = board || document.getElementById('board');
    if (!boardEl) return 0;
    
    const rect = boardEl.getBoundingClientRect();
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

/**
 * Get the current active selection
 * @returns {Object|null} Selection object with text and value, or null
 */
export function getActiveSelection() {
    if (!activeSector) return null;
    const score = activeSector.dataset.score;
    const mode = activeSector.dataset.mode;
    if (mode === 'outerBull') return { text: '25', value: 25 };
    if (mode === 'double') return { text: `D${score}`, value: parseInt(score) * 2 };
    if (mode === 'triple') return { text: `T${score}`, value: parseInt(score) * 3 };
    return { text: score, value: parseInt(score) };
}

/**
 * Show score in the score display element
 * @param {string} text - Score text to display
 */
export function showScore(text) {
    const display = document.getElementById('score-display');
    if (display) {
        display.textContent = text;
        display.classList.add('scale-110');
        setTimeout(() => display.classList.remove('scale-110'), 150);
    }
}

/**
 * Reset the active sector to its original state
 */
export function resetActiveSector() {
    if (activeSector) {
        resetSector(activeSector);
        activeSector = null;
    }
}

/**
 * Reset a sector to its original appearance
 * @param {HTMLElement} sector - The sector element to reset
 */
export function resetSector(sector) {
    if (!sector || !sector.dataset.score) return;
    const label = sector.querySelector('span');
    if (label) {
        label.textContent = sector.dataset.score;
        label.style.color = sector.dataset.originalColor;
    }
    sector.style.background = sector.dataset.originalBg;
    sector.dataset.mode = '';
}

/**
 * Handle sliding out from center (double selection)
 * @param {Event} event - Mouse or touch event
 */
export function slideOutSector(event) {
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

/**
 * Handle sliding in toward center (triple selection)
 * @param {Event} event - Mouse or touch event
 */
export function slideInSector(event) {
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
    
    // Apply triple (T) style - red/green alternating
    const index = sectors.indexOf(parseInt(score));
    const isEven = index % 2 === 0;
    
    sector.style.background = isEven ? '#dc2626' : '#16a34a'; // red-600 / green-600
    label.textContent = `T${score}`;
    label.style.color = '#ffffff';
    sector.dataset.mode = 'triple';
    activeSector = sector;
    
    console.log(`T${score}`);
}

/**
 * Get target coordinates for a selection (where to aim)
 * @param {Object} selection - Selection object with text and value
 * @returns {Object} { r, angle } - polar coordinates (r as % of radius, angle in degrees)
 */
export function getTargetCoordinates(selection) {
    if (!selection) return null;
    
    const { text, value } = selection;
    
    // Handle bulls
    if (value === 50) {
        return { r: TARGET_RADII.BULL_50, angle: 0 }; // Angle doesn't matter for bull
    }
    if (value === 25 || text === '25') {
        return { r: TARGET_RADII.BULL_25, angle: 0 }; // Angle doesn't matter for bull
    }
    
    // Parse the throw type
    const isTriple = text.startsWith('T');
    const isDouble = text.startsWith('D');
    
    // Get the base sector number
    let sectorNumber;
    if (isTriple || isDouble) {
        sectorNumber = parseInt(text.substring(1));
    } else {
        sectorNumber = parseInt(text) || value;
    }
    
    // Find sector index and calculate angle
    const sectorIndex = sectors.indexOf(sectorNumber);
    if (sectorIndex === -1) return null;
    
    // Angle is at the center of the sector (index * 18° + 9°)
    // 0° is at top (sector 20), angles increase clockwise
    const angle = sectorIndex * SECTOR_ANGLE + SECTOR_ANGLE / 2;
    
    // Determine radius based on throw type
    let r;
    if (isTriple) {
        r = TARGET_RADII.TRIPLE;
    } else if (isDouble) {
        r = TARGET_RADII.DOUBLE;
    } else {
        r = TARGET_RADII.SINGLE; // Aim at outer single area
    }
    
    return { r, angle };
}

/**
 * Determine hit result from polar coordinates
 * @param {number} r - Radius as % of board radius (0-100+)
 * @param {number} angle - Angle in degrees (0° = top, clockwise)
 * @returns {Object} { text, value, isDouble, sector }
 */
export function getHitFromCoordinates(r, angle) {
    // Clamp r to valid range (can't be negative, but can overshoot)
    r = Math.max(0, r);
    
    // Normalize angle to 0-360
    angle = ((angle % 360) + 360) % 360;
    
    // Determine which sector based on angle
    // Each sector is 18° wide, sector 20 is at 0-18° (centered at 9°)
    const sectorIndex = Math.floor(angle / SECTOR_ANGLE);
    const sector = sectors[sectorIndex % sectors.length];
    
    // Determine ring based on radius
    let text, value, isDouble = false;
    
    if (r <= RING_BOUNDARIES.BULL_50) {
        // Bullseye (50)
        text = '50';
        value = 50;
        isDouble = true; // Bull counts as double for checkout
    } else if (r <= RING_BOUNDARIES.BULL_25) {
        // Outer bull (25)
        text = '25';
        value = 25;
        isDouble = false;
    } else if (r <= RING_BOUNDARIES.INNER_SINGLE) {
        // Inner single
        text = String(sector);
        value = sector;
        isDouble = false;
    } else if (r <= RING_BOUNDARIES.TRIPLE) {
        // Triple ring
        text = `T${sector}`;
        value = sector * 3;
        isDouble = false;
    } else if (r <= RING_BOUNDARIES.OUTER_SINGLE) {
        // Outer single
        text = String(sector);
        value = sector;
        isDouble = false;
    } else if (r <= RING_BOUNDARIES.DOUBLE) {
        // Double ring
        text = `D${sector}`;
        value = sector * 2;
        isDouble = true;
    } else {
        // Off the board - miss (hit the wire/outside)
        // Return 0 points
        text = '0';
        value = 0;
        isDouble = false;
    }
    
    return { text, value, isDouble, sector };
}

/**
 * Generate a random number from a Gaussian (normal) distribution
 * Uses Box-Muller transform
 * @param {number} mean - Mean of the distribution
 * @param {number} stdDev - Standard deviation
 * @returns {number} Random value from the distribution
 */
function gaussianRandom(mean, stdDev) {
    if (stdDev === 0) return mean;
    
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
}

/**
 * Apply Gaussian variance to polar coordinates
 * @param {number} r - Target radius (% of board)
 * @param {number} angle - Target angle (degrees)
 * @param {number} rStdDev - Radial standard deviation (0-1, as fraction of board radius, so 0.1 = 10%)
 * @param {number} angleStdDev - Angular standard deviation (0-1, as fraction of 360°, so 0.05 = 18°)
 * @returns {Object} { r, angle } - Coordinates with variance applied
 */
export function applyGaussianVariance(r, angle, rStdDev, angleStdDev) {
    // Convert stddev fractions to actual values
    // rStdDev is fraction of 100% board radius
    const rStdDevActual = rStdDev * 100;
    // angleStdDev is fraction of 360°
    const angleStdDevActual = angleStdDev * 360;
    
    // Apply Gaussian variance
    const newR = gaussianRandom(r, rStdDevActual);
    const newAngle = gaussianRandom(angle, angleStdDevActual);
    
    // Clamp r to non-negative (can overshoot past 100 though)
    return {
        r: Math.max(0, newR),
        angle: newAngle
    };
}

