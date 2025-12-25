/**
 * PartyKit Sync Module
 * Handles real-time game state synchronization between devices
 */

import PartySocket from "partysocket";

// PartyKit host - uses local dev server or production
const PARTYKIT_HOST = import.meta.env.DEV 
  ? "localhost:1999" 
  : "darts-counter.niemenmaa.partykit.dev"; // Update this after first deploy

let socket = null;
let currentRoomCode = null;
let onStateUpdate = null;
let onConnectionChange = null;
let isConnected = false;

/**
 * Generate a random 6-character room code
 */
export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars (I, O, 0, 1)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Connect to a PartyKit room
 * @param {string} roomCode - The room code to connect to
 * @param {Function} stateCallback - Called when state updates are received
 * @param {Function} connectionCallback - Called when connection status changes
 */
export function connectToRoom(roomCode, stateCallback, connectionCallback) {
  // Disconnect from existing room if any
  disconnect();

  currentRoomCode = roomCode.toUpperCase();
  onStateUpdate = stateCallback;
  onConnectionChange = connectionCallback;

  try {
    socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: currentRoomCode,
    });

    socket.addEventListener("open", () => {
      console.log(`🔗 Connected to room: ${currentRoomCode}`);
      isConnected = true;
      if (onConnectionChange) {
        onConnectionChange({ connected: true, roomCode: currentRoomCode });
      }
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "state" && onStateUpdate) {
          onStateUpdate(data.state);
        }
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    });

    socket.addEventListener("close", () => {
      console.log("🔌 Disconnected from room");
      isConnected = false;
      if (onConnectionChange) {
        onConnectionChange({ connected: false, roomCode: null });
      }
    });

    socket.addEventListener("error", (e) => {
      console.error("WebSocket error:", e);
      isConnected = false;
      if (onConnectionChange) {
        onConnectionChange({ connected: false, roomCode: null, error: true });
      }
    });

    return true;
  } catch (e) {
    console.error("Failed to connect:", e);
    return false;
  }
}

/**
 * Broadcast game state to all connected clients
 * @param {Object} gameState - The current game state to broadcast
 */
export function broadcastState(gameState) {
  if (socket && isConnected) {
    socket.send(JSON.stringify({ type: "state", state: gameState }));
  }
}

/**
 * Request current state from the room (useful after reconnect)
 */
export function requestState() {
  if (socket && isConnected) {
    socket.send(JSON.stringify({ type: "request_state" }));
  }
}

/**
 * Disconnect from current room
 */
export function disconnect() {
  if (socket) {
    socket.close();
    socket = null;
  }
  currentRoomCode = null;
  isConnected = false;
  onStateUpdate = null;
  onConnectionChange = null;
}

/**
 * Get current connection status
 */
export function getConnectionStatus() {
  return {
    connected: isConnected,
    roomCode: currentRoomCode,
  };
}

/**
 * Check if currently connected to a room
 */
export function isInRoom() {
  return isConnected && currentRoomCode !== null;
}

/**
 * Get current room code
 */
export function getRoomCode() {
  return currentRoomCode;
}

