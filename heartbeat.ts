// services/heartbeat.ts - Connection health monitoring
// Automatically terminates unresponsive connections

import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types";
import { connectionManager } from "./connections";
import { roomManager } from "./rooms";

interface HeartbeatConfig {
  pingInterval: number;    // How often to send pings (milliseconds)
  pongTimeout: number;     // How long to wait for pong response
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  pingInterval: 30000,     // 30 seconds
  pongTimeout: 10000,      // 10 seconds
};

class HeartbeatManager {
  private config: HeartbeatConfig;
  // Track clients waiting for pong responses
  private pendingPongs: Map<string, Timer> = new Map();
  // Track ping interval timers for each client
  private pingIntervals: Map<string, Timer> = new Map();

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Start heartbeat monitoring for a new connection
  startHeartbeat(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;

    // Set up recurring ping
    const intervalId = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.stopHeartbeat(clientId);
        return;
      }

      // Send ping message
      try {
        ws.send(JSON.stringify({
          type: "ping",
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error(`Failed to send ping to ${clientId}:`, error);
        this.stopHeartbeat(clientId);
        return;
      }

      // Set timeout for pong response
      const timeoutId = setTimeout(() => {
        console.log(`Client ${clientId} heartbeat timeout, closing connection`);
        this.stopHeartbeat(clientId);
        
        // Clean up and close the connection
        roomManager.leaveAllRooms(ws);
        connectionManager.removeClient(clientId);
        ws.close(1000, "Heartbeat timeout");
      }, this.config.pongTimeout);

      this.pendingPongs.set(clientId, timeoutId);
    }, this.config.pingInterval);

    this.pingIntervals.set(clientId, intervalId);
    console.log(`Heartbeat started for client ${clientId}`);
  }

  // Called when a pong is received from a client
  receivePong(clientId: string): void {
    const timeoutId = this.pendingPongs.get(clientId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pendingPongs.delete(clientId);
    }
  }

  // Stop heartbeat monitoring for a client
  stopHeartbeat(clientId: string): void {
    const intervalId = this.pingIntervals.get(clientId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pingIntervals.delete(clientId);
    }

    const timeoutId = this.pendingPongs.get(clientId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pendingPongs.delete(clientId);
    }

    console.log(`Heartbeat stopped for client ${clientId}`);
  }
}

export const heartbeatManager = new HeartbeatManager();
