// services/rooms.ts - Room management using Bun's native pub/sub
// Each room is a topic that clients can subscribe to

import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types";

class RoomManager {
  // Track room memberships for cleanup purposes
  private roomMembers: Map<string, Set<string>> = new Map();

  // Have a client join a room/topic
  joinRoom(ws: ServerWebSocket<WebSocketData>, roomName: string): void {
    // Subscribe the WebSocket to the topic
    ws.subscribe(roomName);
    ws.data.rooms.add(roomName);

    // Track membership
    if (!this.roomMembers.has(roomName)) {
      this.roomMembers.set(roomName, new Set());
    }
    this.roomMembers.get(roomName)!.add(ws.data.clientId);

    console.log(`Client ${ws.data.clientId} joined room: ${roomName}`);

    // Notify the room about the new member
    ws.publish(roomName, JSON.stringify({
      type: "user_joined",
      room: roomName,
      userId: ws.data.clientId,
      username: ws.data.username || "Anonymous",
      timestamp: Date.now(),
    }));

    // Confirm to the joining client
    ws.send(JSON.stringify({
      type: "room_joined",
      room: roomName,
      memberCount: this.getRoomMemberCount(roomName),
    }));
  }

  // Have a client leave a room/topic
  leaveRoom(ws: ServerWebSocket<WebSocketData>, roomName: string): void {
    ws.unsubscribe(roomName);
    ws.data.rooms.delete(roomName);

    // Update membership tracking
    const members = this.roomMembers.get(roomName);
    if (members) {
      members.delete(ws.data.clientId);
      if (members.size === 0) {
        this.roomMembers.delete(roomName);
      }
    }

    console.log(`Client ${ws.data.clientId} left room: ${roomName}`);

    // Notify remaining room members
    ws.publish(roomName, JSON.stringify({
      type: "user_left",
      room: roomName,
      userId: ws.data.clientId,
      username: ws.data.username || "Anonymous",
      timestamp: Date.now(),
    }));
  }

  // Remove a client from all rooms when they disconnect
  leaveAllRooms(ws: ServerWebSocket<WebSocketData>): void {
    for (const room of ws.data.rooms) {
      this.leaveRoom(ws, room);
    }
  }

  // Send a message to all members of a room
  broadcastToRoom(
    ws: ServerWebSocket<WebSocketData>,
    roomName: string,
    message: string,
    includeSelf: boolean = false
  ): void {
    if (includeSelf) {
      // Use server.publish to include the sender
      ws.publish(roomName, message);
      ws.send(message);
    } else {
      // Default behavior excludes the sender
      ws.publish(roomName, message);
    }
  }

  // Get the list of rooms a client is in
  getClientRooms(clientId: string): string[] {
    const rooms: string[] = [];
    for (const [roomName, members] of this.roomMembers) {
      if (members.has(clientId)) {
        rooms.push(roomName);
      }
    }
    return rooms;
  }

  // Get the number of members in a room
  getRoomMemberCount(roomName: string): number {
    return this.roomMembers.get(roomName)?.size || 0;
  }
}

export const roomManager = new RoomManager();
