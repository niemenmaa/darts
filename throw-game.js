/**
 * Just Throw Mode - Game Logic
 * Free throwing mode with infinite darts, tracking last 50 throws
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
    resetActiveSector,
    getTargetCoordinates,
    getHitFromCoordinates,
    applyGaussianVariance,
    RING_BOUNDARIES,
    SECTOR_ANGLE
} from './board.js';

// Re-export board utilities for throw-app.js
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

const MAX_HISTORY = 50;

// Settings
let settings = {
    rStdDev: 0,      // 0-1: radial standard deviation (σ)
    angleStdDev: 0,  // 0-1: angular standard deviation (σ, fraction of 360°)
};

// Game state
let throwHistory = []; // Array of { text, value, wasMiss, timestamp }
let totalScore = 0;

// Load settings from cookie
function loadSettings() {
    const saved = getCookie();
    if (saved) {
        settings.rStdDev = saved.rStdDev ?? 0;
        settings.angleStdDev = saved.angleStdDev ?? 0;
    }
}

// Save settings to cookie
function saveSettings() {
    const currentCookie = getCookie() || {};
    setCookie({
        ...currentCookie,
        rStdDev: settings.rStdDev,
        angleStdDev: settings.angleStdDev
    });
}

// Update settings
export function updateSettings(newSettings) {
    if (newSettings.rStdDev !== undefined) settings.rStdDev = Math.max(0, Math.min(1, newSettings.rStdDev));
    if (newSettings.angleStdDev !== undefined) settings.angleStdDev = Math.max(0, Math.min(1, newSettings.angleStdDev));
    saveSettings();
}

// Get current settings
export function getSettings() {
    return { ...settings };
}

// Initialize settings on load
loadSettings();

// Get throw history
export function getThrowHistory() {
    return [...throwHistory];
}

// Get total score
export function getTotalScore() {
    return totalScore;
}

// Get throw count
export function getThrowCount() {
    return throwHistory.length;
}

// Get average per throw
export function getAveragePerThrow() {
    if (throwHistory.length === 0) return 0;
    return totalScore / throwHistory.length;
}

// Reset the session
export function resetSession() {
    throwHistory = [];
    totalScore = 0;
    clearBoardMarkers();
}

// Apply miss chance to a selection using polar coordinate system with Gaussian variance
function applyMissChance(selection) {
    if (!selection) return null;
    
    const original = { ...selection };
    
    // If both stddev values are 0, no variance - return exact hit
    if (settings.rStdDev === 0 && settings.angleStdDev === 0) {
        return { original, actual: { ...original }, wasMiss: false };
    }
    
    // Get target coordinates for the intended throw
    const targetCoords = getTargetCoordinates(selection);
    if (!targetCoords) {
        return { original, actual: { ...original }, wasMiss: false };
    }
    
    // Apply Gaussian variance to the coordinates
    const actualCoords = applyGaussianVariance(
        targetCoords.r,
        targetCoords.angle,
        settings.rStdDev,
        settings.angleStdDev
    );
    
    // Determine the actual hit from the deviated coordinates
    const hitResult = getHitFromCoordinates(actualCoords.r, actualCoords.angle);
    
    const actual = {
        text: hitResult.text,
        value: hitResult.value
    };
    
    const wasMiss = actual.text !== original.text;
    
    return { original, actual, wasMiss, actualCoords };
}

// Add a marker to the board showing where a dart landed
function addBoardMarker(hitResult, wasMiss, actualCoords) {
    const board = document.getElementById('board');
    if (!board) return;
    
    // Create marker element
    const marker = document.createElement('div');
    marker.className = `dart-marker absolute w-2.5 h-2.5 rounded-full z-30 pointer-events-none transition-all duration-300 ${wasMiss ? 'bg-yellow-400 border-yellow-600' : 'bg-cyan-400 border-cyan-600'} border-2`;
    marker.style.boxShadow = wasMiss ? '0 0 6px rgba(250, 204, 21, 0.5)' : '0 0 6px rgba(34, 211, 238, 0.5)';
    
    // Position based on actual coordinates if available
    if (actualCoords) {
        // Convert polar to cartesian (0,0 at center, positive y up)
        const { r, angle } = actualCoords;
        // Angle: 0° = top (20), increases clockwise
        // Convert to standard math angle (0° = right, counter-clockwise)
        const mathAngle = (90 - angle) * Math.PI / 180;
        
        // r is percentage of board radius (0-100+)
        const x = 50 + (r / 100) * 50 * Math.cos(mathAngle);
        const y = 50 - (r / 100) * 50 * Math.sin(mathAngle);
        
        marker.style.cssText += `top: ${y}%; left: ${x}%; transform: translate(-50%, -50%);`;
    } else {
        // Fallback: position based on hit result
        const text = hitResult.text;
        const value = hitResult.value;
        
        if (value === 50 || value === 25) {
            // Bull - position near center
            const offset = Math.random() * 3;
            const angle = Math.random() * Math.PI * 2;
            const x = 50 + offset * Math.cos(angle);
            const y = 50 + offset * Math.sin(angle);
            marker.style.cssText += `top: ${y}%; left: ${x}%; transform: translate(-50%, -50%);`;
        } else {
            // Sector
            let sectorNum = parseInt(text.replace(/[TD]/g, ''));
            const sectorIndex = sectors.indexOf(sectorNum);
            const sectorAngle = 360 / sectors.length;
            const angle = (sectorIndex * sectorAngle - 90) * Math.PI / 180;
            const radius = 30 + Math.random() * 15;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            marker.style.cssText += `top: ${y}%; left: ${x}%; transform: translate(-50%, -50%);`;
        }
    }
    
    board.appendChild(marker);
    
    // Remove oldest markers if we have too many
    const markers = board.querySelectorAll('.dart-marker');
    if (markers.length > MAX_HISTORY) {
        // Fade out and remove the oldest marker
        const oldestMarker = markers[0];
        oldestMarker.style.opacity = '0';
        oldestMarker.style.transform = 'translate(-50%, -50%) scale(0)';
        setTimeout(() => oldestMarker.remove(), 300);
    }
}

// Clear all dart markers from board
export function clearBoardMarkers() {
    const board = document.getElementById('board');
    if (!board) return;
    board.querySelectorAll('.dart-marker').forEach(m => m.remove());
}

// Handle a throw
export function handleThrow(selection) {
    if (!selection) return null;
    
    // Apply miss chance
    const missResult = applyMissChance(selection);
    if (!missResult) return null;
    
    const { original, actual, wasMiss, actualCoords } = missResult;
    
    // Add to history
    const throwRecord = {
        text: actual.text,
        value: actual.value,
        wasMiss,
        original: wasMiss ? original : null,
        timestamp: Date.now()
    };
    
    throwHistory.unshift(throwRecord);
    
    // Keep only last MAX_HISTORY throws
    if (throwHistory.length > MAX_HISTORY) {
        throwHistory.pop();
    }
    
    // Update total score
    totalScore += actual.value;
    
    // Add marker to board
    addBoardMarker(actual, wasMiss, actualCoords);
    
    return { original, actual, wasMiss };
}

