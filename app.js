/**
 * Darts - Vanilla JS Application
 */

import { settings, sectors, buildBoard, slideOutSector, slideInSector, resetActiveSector, getActiveSelection, getDistanceFromCenter, INTERACTIVE_ZONE_MIN, generateTarget, handleThrow, updateSettings } from './game.js';
import './style.css';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Darts app initialized');
  
  init();
});

/**
 * Initialize the application
 */
function init() {
  const board = buildBoard(sectors);
  document.getElementById('board-container').appendChild(board);
  setupBoardEventListeners();
  setupMenu();
  setupSettingsModal();
  
  // Start first game
  generateTarget();
}

/**
 * Setup hamburger menu
 */
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

/**
 * Setup settings modal
 */
function setupSettingsModal() {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const settingsSave = document.getElementById('settings-save');
  const settingsMin = document.getElementById('settings-min');
  const settingsMax = document.getElementById('settings-max');
  const settingsMentalMath = document.getElementById('settings-mental-math');
  const settingsRingAccuracy = document.getElementById('settings-ring-accuracy');
  const settingsSectorAccuracy = document.getElementById('settings-sector-accuracy');
  const ringAccuracyValue = document.getElementById('ring-accuracy-value');
  const sectorAccuracyValue = document.getElementById('sector-accuracy-value');
  
  // Initialize form with current settings
  function loadFormValues() {
    settingsMin.value = settings.min;
    settingsMax.value = settings.max;
    updateMentalMathToggle(settings.mentalMathMode);
    settingsRingAccuracy.value = settings.ringAccuracy;
    settingsSectorAccuracy.value = settings.sectorAccuracy;
    ringAccuracyValue.textContent = `${settings.ringAccuracy}%`;
    sectorAccuracyValue.textContent = `${settings.sectorAccuracy}%`;
  }
  
  // Update toggle visual state
  function updateMentalMathToggle(enabled) {
    const toggle = settingsMentalMath;
    const knob = toggle.querySelector('span');
    if (enabled) {
      toggle.classList.remove('bg-slate-600');
      toggle.classList.add('bg-emerald-500');
      knob.classList.add('translate-x-5');
    } else {
      toggle.classList.add('bg-slate-600');
      toggle.classList.remove('bg-emerald-500');
      knob.classList.remove('translate-x-5');
    }
    toggle.dataset.enabled = enabled;
  }
  
  // Update accuracy value displays in real-time
  settingsRingAccuracy.addEventListener('input', () => {
    ringAccuracyValue.textContent = `${settingsRingAccuracy.value}%`;
  });
  
  settingsSectorAccuracy.addEventListener('input', () => {
    sectorAccuracyValue.textContent = `${settingsSectorAccuracy.value}%`;
  });
  
  // Open modal
  settingsBtn.addEventListener('click', () => {
    // Close menu dropdown
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
  
  // Toggle mental math mode
  settingsMentalMath.addEventListener('click', () => {
    const currentState = settingsMentalMath.dataset.enabled === 'true';
    updateMentalMathToggle(!currentState);
  });
  
  // Save settings
  settingsSave.addEventListener('click', () => {
    const newMin = parseInt(settingsMin.value) || 2;
    const newMax = parseInt(settingsMax.value) || 170;
    const mentalMathEnabled = settingsMentalMath.dataset.enabled === 'true';
    const ringAccuracy = parseInt(settingsRingAccuracy.value) || 100;
    const sectorAccuracy = parseInt(settingsSectorAccuracy.value) || 100;
    
    updateSettings({
      min: newMin,
      max: newMax,
      mentalMathMode: mentalMathEnabled,
      ringAccuracy: ringAccuracy,
      sectorAccuracy: sectorAccuracy
    });
    
    closeModal();
    generateTarget(); // Start new game with new settings
  });
}

function setupBoardEventListeners() {
  const board = document.getElementById('board');
  
  // Drag direction tracking
  let isDragging = false;
  let lastDistance = null;
  let lockedDirection = null; // 'out' for double, 'in' for triple
  let hasDragged = false; // Track if actual dragging occurred
  let inInteractiveZone = false; // Track if drag started in interactive zone
  
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
    
    // Check if starting in interactive zone or on bullseye
    const sector = event.target.closest('[data-score]');
    const isBullseye = sector && sector.dataset.score === '50';
    const distancePercent = getDistanceFromCenter(event);
    inInteractiveZone = isBullseye || distancePercent >= INTERACTIVE_ZONE_MIN;
  }
  
  function handleDragMove(clientX, clientY, event) {
    if (!isDragging || !inInteractiveZone) return;
    
    const currentDistance = getLocalDistanceFromCenter(clientX, clientY);
    const threshold = 5; // minimum movement to trigger
    
    // Lock direction on first significant movement
    if (!lockedDirection && Math.abs(currentDistance - lastDistance) > threshold) {
      lockedDirection = currentDistance > lastDistance ? 'out' : 'in';
      hasDragged = true;
    }
    
    // Apply the locked direction
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
        handleThrow(selection);
      }
    }
    
    isDragging = false;
    lastDistance = null;
    lockedDirection = null;
    inInteractiveZone = false;
    resetActiveSector();
  }
  
  function handleClick(event) {
    // Only handle click if no drag occurred
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    
    const sector = event.target.closest('[data-score]');
    if (sector) {
      // Allow bullseye clicks always, check zone for sectors
      if (sector.dataset.score === '50') {
        handleThrow({ text: '50', value: 50 });
      } else {
        // Check if click is in interactive zone (53-100%)
        const distance = getDistanceFromCenter(event);
        if (distance >= INTERACTIVE_ZONE_MIN) {
          const score = parseInt(sector.dataset.score);
          handleThrow({ text: String(score), value: score });
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
