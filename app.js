/**
 * Darts - Vanilla JS Application
 */

import { sectors, buildBoard, slideOutSector, slideInSector, resetActiveSector, getActiveSelection, getDistanceFromCenter, INTERACTIVE_ZONE_MIN, generateTarget, handleThrow } from './game.js';
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
  
  // Start first game
  generateTarget();
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
