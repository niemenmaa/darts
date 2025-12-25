/**
 * Darts - Vanilla JS Application
 */

import { settings, sectors, buildBoard, buildGrid, slideOutSector, slideInSector, resetActiveSector, getActiveSelection, showScore, handleModifierClick, handleGridNumberClick, resetModifier } from './game.js';
import './style.css';

let currentMode = 'board';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Darts app initialized');
  
  init();
});

/**
 * Initialize the application
 */
function init() {
  // Build both views
  const board = buildBoard(sectors);
  const grid = buildGrid();
  
  document.getElementById('board-container').appendChild(board);
  document.getElementById('grid-container').appendChild(grid);
  
  // Set up event listeners
  setupBoardEventListeners();
  setupGridEventListeners();
  setupModeSelector();
}

function setupModeSelector() {
  const modeSelect = document.getElementById('mode-select');
  const boardContainer = document.getElementById('board-container');
  const gridContainer = document.getElementById('grid-container');
  
  function setMode(mode, updateHash = true) {
    currentMode = mode;
    modeSelect.value = mode;
    
    if (mode === 'board') {
      boardContainer.classList.remove('hidden');
      gridContainer.classList.add('hidden');
    } else {
      boardContainer.classList.add('hidden');
      gridContainer.classList.remove('hidden');
      resetModifier();
    }
    
    // Update URL hash
    if (updateHash) {
      window.location.hash = mode;
    }
  }
  
  // Check URL hash on load
  const hash = window.location.hash.slice(1); // Remove #
  if (hash === 'board' || hash === 'grid') {
    setMode(hash, false);
  }
  
  // Listen for dropdown changes
  modeSelect.addEventListener('change', (e) => setMode(e.target.value));
  
  // Listen for hash changes (back/forward browser navigation)
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.slice(1);
    if (newHash === 'board' || newHash === 'grid') {
      setMode(newHash, false);
    }
  });
}

function setupGridEventListeners() {
  const grid = document.getElementById('grid');
  
  // Modifier buttons
  grid.addEventListener('click', (e) => {
    const modifier = e.target.dataset.modifier;
    if (modifier) {
      handleModifierClick(modifier);
      return;
    }
    
    const number = e.target.dataset.number;
    if (number) {
      handleGridNumberClick(number);
    }
  });
}

function setupBoardEventListeners() {
  const board = document.getElementById('board');
  
  // Drag direction tracking
  let isDragging = false;
  let lastDistance = null;
  let lockedDirection = null; // 'out' for double, 'in' for triple
  let hasDragged = false; // Track if actual dragging occurred
  
  function getCenter() {
    const rect = board.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
  
  function getDistanceFromCenter(clientX, clientY) {
    const center = getCenter();
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function handleDragStart(clientX, clientY) {
    isDragging = true;
    hasDragged = false;
    lastDistance = getDistanceFromCenter(clientX, clientY);
    lockedDirection = null;
  }
  
  function handleDragMove(clientX, clientY, event) {
    if (!isDragging) return;
    
    const currentDistance = getDistanceFromCenter(clientX, clientY);
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
    // Show score if we had a locked direction
    if (lockedDirection) {
      const selection = getActiveSelection();
      if (selection) {
        showScore(selection.text);
      }
    }
    
    isDragging = false;
    lastDistance = null;
    lockedDirection = null;
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
      showScore(sector.dataset.score);
    }
  }
  
  // Mouse events
  board.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
  board.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY, e));
  board.addEventListener('mouseup', (e) => handleDragEnd(e));
  board.addEventListener('mouseleave', (e) => handleDragEnd(e));
  board.addEventListener('click', handleClick);
  
  // Touch events
  board.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, { passive: true });
  
  board.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY, e);
  }, { passive: true });
  
  board.addEventListener('touchend', (e) => handleDragEnd(e));
  board.addEventListener('touchcancel', (e) => handleDragEnd(e));
}
