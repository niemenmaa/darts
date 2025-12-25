import type * as Party from "partykit/server";

/**
 * Darts Counter Party Server
 * Handles real-time game state synchronization between devices
 */

type GameState = {
  players: Array<{
    name: string;
    score: number;
    history: Array<{
      round: number;
      throws: Array<{ text: string; value: number; isDouble: boolean }>;
      bust: boolean;
      scoreAfter: number;
    }>;
  }>;
  currentPlayerIndex: number;
  startingScore: number;
  doubleOut: boolean;
  currentTurn: {
    throws: Array<{ text: string; value: number; isDouble: boolean }>;
    scoreAtStart: number;
  };
  gameStarted: boolean;
  winner: { name: string } | null;
  mentalMathMode: boolean;
};

type Message =
  | { type: "state"; state: GameState }
  | { type: "request_state" };

export default class DartsParty implements Party.Server {
  gameState: GameState | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send current state to newly connected client
    if (this.gameState) {
      conn.send(JSON.stringify({ type: "state", state: this.gameState }));
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: Message = JSON.parse(message);

      if (data.type === "state") {
        // Update stored state and broadcast to all clients
        this.gameState = data.state;
        this.room.broadcast(message);
      } else if (data.type === "request_state") {
        // Client requesting current state (e.g., on reconnect)
        if (this.gameState) {
          sender.send(JSON.stringify({ type: "state", state: this.gameState }));
        }
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  }

  onClose(conn: Party.Connection) {
    // Connection closed - state persists for other connected clients
  }
}

DartsParty satisfies Party.Worker;

