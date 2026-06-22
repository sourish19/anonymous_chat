// index.ts - WebSocket server with authentication
// Rejects unauthenticated connections during the upgrade phase

import { authenticateRequest, type UserPayload } from "./services/auth";
import { connectionManager } from "./services/connections";
import { roomManager } from "./services/rooms";
import { handleMessage } from "./handlers/message";
import type { WebSocketData } from "./types";

const server = Bun.serve<WebSocketData>({
  port: 8080,

  async fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      // Authenticate before upgrading the connection
      const user = await authenticateRequest(request);

      if (!user) {
        return new Response("Unauthorized: Valid token required", {
          status: 401,
        });
      }

      // Create connection data with authenticated user info
      const wsData: WebSocketData = {
        clientId: crypto.randomUUID(),
        userId: user.userId,
        username: user.username,
        connectedAt: new Date(),
        rooms: new Set(),
      };

      const upgraded = server.upgrade(request, { data: wsData });
      if (upgraded) return undefined;

      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        connections: connectionManager.getClientCount(),
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Bun WebSocket Server");
  },

  websocket: {
    open(ws) {
      connectionManager.addClient(ws);

      ws.send(JSON.stringify({
        type: "authenticated",
        clientId: ws.data.clientId,
        userId: ws.data.userId,
        username: ws.data.username,
        timestamp: Date.now(),
      }));
    },

    message(ws, message) {
      handleMessage(ws, message);
    },

    close(ws, code, reason) {
      roomManager.leaveAllRooms(ws);
      connectionManager.removeClient(ws.data.clientId);
    },
  },
});

console.log(`Authenticated WebSocket server running at ${server.port}`);
