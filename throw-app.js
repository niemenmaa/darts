/**
 * Just Throw Mode - App Controller
 * UI and event handling for free throwing practice
 */

import {
    buildBoard,
    getDistanceFromCenter,
    INTERACTIVE_ZONE_MIN,
    getActiveSelection,
    slideOutSector,
    slideInSector,
    resetActiveSector,
    handleThrow,
    getThrowHistory,
    getTotalScore,
    getThrowCount,
    getAveragePerThrow,
    resetSession,
    getSettings,
    updateSettings,
    clearBoardMarkers
} from './throw-game.js';
import './style.css';

// Board interaction state
let isDragging = false;
let lastDistance = null;
let lockedDirection = null;
let hasDragged = false;
let inInteractiveZone = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Just Throw mode initialized');
    init();
});

function init() {
    setupMenu();
    setupSettingsModal();
    setupBoard();
    updateUI();
}

// ==========================================
// Menu
// ==========================================

function setupMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    const resetBtn = document.getElementById('reset-btn');
    
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
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
        if (confirm('Reset score and clear history?')) {
            resetSession();
            updateUI();
        }
    });
}

// ==========================================
// Settings Modal
// ==========================================

function setupSettingsModal() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsSave = document.getElementById('settings-save');
    const settingsRStdDev = document.getElementById('settings-r-stddev');
    const settingsAngleStdDev = document.getElementById('settings-angle-stddev');
    const rStdDevValue = document.getElementById('r-stddev-value');
    const angleStdDevValue = document.getElementById('angle-stddev-value');
    
    // Initialize form with current settings
    function loadFormValues() {
        const settings = getSettings();
        settingsRStdDev.value = settings.rStdDev;
        settingsAngleStdDev.value = settings.angleStdDev;
        rStdDevValue.textContent = settings.rStdDev.toFixed(2);
        angleStdDevValue.textContent = settings.angleStdDev.toFixed(2);
    }
    
    // Update stddev value displays in real-time
    settingsRStdDev.addEventListener('input', () => {
        rStdDevValue.textContent = parseFloat(settingsRStdDev.value).toFixed(2);
    });
    
    settingsAngleStdDev.addEventListener('input', () => {
        angleStdDevValue.textContent = parseFloat(settingsAngleStdDev.value).toFixed(2);
    });
    
    // Open modal
    settingsBtn.addEventListener('click', () => {
        document.getElementById('menu-dropdown').classList.add('hidden');
        loadFormValues();
        settingsModal.classList.remove('hidden');
        settingsModal.classList.add('flex');
    });
    
    // Close modal
    function closeModal() {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('flex');
    }
    
    settingsClose.addEventListener('click', closeModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });
    
    // Save settings
    settingsSave.addEventListener('click', () => {
        const rStdDev = parseFloat(settingsRStdDev.value) || 0;
        const angleStdDev = parseFloat(settingsAngleStdDev.value) || 0;
        
        updateSettings({
            rStdDev: rStdDev,
            angleStdDev: angleStdDev
        });
        
        closeModal();
    });
}

// ==========================================
// Board Setup
// ==========================================

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
    
    function handleDragStart(clientX, clientY, event) {
        isDragging = true;
        hasDragged = false;
        lastDistance = getLocalDistanceFromCenter(clientX, clientY);
        lockedDirection = null;
        
        const sector = event.target.closest('[data-score]');
        const isBullseye = sector && sector.dataset.score === '50';
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
        
        if (lockedDirection === 'out') {
            slideOutSector(event);
        } else if (lockedDirection === 'in') {
            slideInSector(event);
        }
    }
    
    function handleDragEnd(event) {
        if (lockedDirection) {
            const selection = getActiveSelection();
            if (selection) {
                processThrow(selection);
            }
        }
        
        resetActiveSector();
        isDragging = false;
        lastDistance = null;
        lockedDirection = null;
        inInteractiveZone = false;
    }
    
    function handleClick(event) {
        if (hasDragged) {
            hasDragged = false;
            return;
        }
        
        const sector = event.target.closest('[data-score]');
        if (sector) {
            if (sector.dataset.score === '50') {
                processThrow({ text: '50', value: 50 });
            } else {
                const distancePercent = getDistanceFromCenter(event, board);
                if (distancePercent >= INTERACTIVE_ZONE_MIN) {
                    const score = parseInt(sector.dataset.score);
                    processThrow({ text: String(score), value: score });
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

// ==========================================
// Throw Processing
// ==========================================

function processThrow(selection) {
    const result = handleThrow(selection);
    if (!result) return;
    
    const { original, actual, wasMiss } = result;
    
    // Show miss notification if applicable
    if (wasMiss) {
        showMissNotification(original, actual);
    }
    
    // Show last throw
    showLastThrow(actual.text, wasMiss);
    
    // Update UI
    updateUI();
}

function showMissNotification(original, actual) {
    const notification = document.getElementById('miss-notification');
    if (!notification) return;
    
    notification.textContent = `Missed! ${original.text} → ${actual.text}`;
    notification.style.opacity = '1';
    
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 2000);
}

function showLastThrow(text, wasMiss) {
    const lastThrow = document.getElementById('last-throw');
    if (!lastThrow) return;
    
    lastThrow.textContent = text;
    lastThrow.className = `text-2xl font-bold h-8 mt-1 transition-all ${wasMiss ? 'text-yellow-400' : 'text-white'}`;
    
    // Add pop animation
    lastThrow.style.transform = 'scale(1.2)';
    setTimeout(() => {
        lastThrow.style.transform = 'scale(1)';
    }, 150);
}

// ==========================================
// UI Updates
// ==========================================

function updateUI() {
    const totalScoreEl = document.getElementById('total-score');
    const throwCountEl = document.getElementById('throw-count');
    const avgDisplayEl = document.getElementById('avg-display');
    const historyDisplay = document.getElementById('history-display');
    
    // Update score
    if (totalScoreEl) {
        totalScoreEl.textContent = getTotalScore();
    }
    
    // Update throw count
    const count = getThrowCount();
    if (throwCountEl) {
        throwCountEl.textContent = `${count} throw${count !== 1 ? 's' : ''}`;
    }
    
    // Update average
    if (avgDisplayEl) {
        const avg = getAveragePerThrow();
        if (count > 0) {
            avgDisplayEl.textContent = `${avg.toFixed(1)} avg`;
            avgDisplayEl.className = 'text-lg text-slate-400';
        } else {
            avgDisplayEl.textContent = '—';
            avgDisplayEl.className = 'text-lg text-slate-500';
        }
    }
    
    // Update history display
    if (historyDisplay) {
        const history = getThrowHistory();
        
        if (history.length === 0) {
            historyDisplay.innerHTML = '<div class="text-slate-500 text-center text-xs">Throw history will appear here</div>';
        } else {
            // Group throws by chunks of 3 (like turns)
            const chunks = [];
            for (let i = 0; i < history.length; i += 3) {
                chunks.push(history.slice(i, i + 3));
            }
            
            historyDisplay.innerHTML = chunks.map((chunk, chunkIndex) => {
                const throwsHtml = chunk.map(t => {
                    const colorClass = t.wasMiss ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 
                                      t.value >= 40 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                                      t.value >= 20 ? 'bg-slate-600 text-white border-slate-500' :
                                      'bg-slate-700 text-slate-300 border-slate-600';
                    return `<span class="px-1.5 py-0.5 rounded text-xs border ${colorClass}">${t.text}</span>`;
                }).join('');
                
                const chunkTotal = chunk.reduce((sum, t) => sum + t.value, 0);
                const turnNum = chunkIndex + 1;
                
                return `
                    <div class="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0">
                        <div class="flex gap-1">${throwsHtml}</div>
                        <span class="text-xs font-mono ${chunkTotal >= 60 ? 'text-cyan-400' : chunkTotal >= 40 ? 'text-slate-300' : 'text-slate-500'}">${chunkTotal}</span>
                    </div>
                `;
            }).join('');
        }
    }
}


