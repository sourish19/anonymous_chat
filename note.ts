// index.ts - Complete chat application with Bun WebSockets
// Implements rooms, authentication, typing indicators, and message history

import type { ServerWebSocket } from "bun";

// Define the data attached to each WebSocket connection
interface ChatUserData {
	clientId: string;
	userId: string;
	username: string;
	connectedAt: Date;
	rooms: Set<string>;
	isTyping: Map<string, boolean>;
}

// Message types for the chat protocol
type ChatMessage =
	| { type: "join_room"; room: string }
	| { type: "leave_room"; room: string }
	| { type: "chat"; room: string; text: string }
	| { type: "typing"; room: string; isTyping: boolean }
	| { type: "pong" }
	| { type: "get_rooms" };

// Track connected clients
const clients = new Map<string, ServerWebSocket<ChatUserData>>();

// Store recent messages per room for new joiners
const messageHistory = new Map<
	string,
	Array<{
		username: string;
		text: string;
		timestamp: number;
	}>
>();

const MAX_HISTORY = 50;

// Add message to room history
function addToHistory(room: string, username: string, text: string): void {
	if (!messageHistory.has(room)) {
		messageHistory.set(room, []);
	}
	const history = messageHistory.get(room)!;
	history.push({ username, text, timestamp: Date.now() });

	// Keep only recent messages
	if (history.length > MAX_HISTORY) {
		history.shift();
	}
}

const server = Bun.serve<ChatUserData>({
	port: 8080,

	fetch(request, server) {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			// Extract username from query params (simplified auth for demo)
			const username = url.searchParams.get("username");
			if (!username) {
				return new Response("Username required", { status: 400 });
			}

			const userData: ChatUserData = {
				clientId: crypto.randomUUID(),
				userId: crypto.randomUUID(),
				username,
				connectedAt: new Date(),
				rooms: new Set(),
				isTyping: new Map(),
			};

			const upgraded = server.upgrade(request, { data: userData });
			if (upgraded) return undefined;

			return new Response("Upgrade failed", { status: 400 });
		}

		// Serve a simple HTML chat client
		if (url.pathname === "/") {
			return new Response(getChatClientHtml(), {
				headers: { "Content-Type": "text/html" },
			});
		}

		return new Response("Not Found", { status: 404 });
	},

	websocket: {
		// Called when a client connects
		open(ws) {
			clients.set(ws.data.clientId, ws);

			ws.send(
				JSON.stringify({
					type: "welcome",
					clientId: ws.data.clientId,
					username: ws.data.username,
					availableRooms: ["general", "random", "tech"],
				}),
			);

			console.log(`${ws.data.username} connected (${clients.size} total)`);
		},

		// Called when a message is received
		message(ws, rawMessage) {
			let msg: ChatMessage;
			try {
				msg = JSON.parse(
					typeof rawMessage === "string" ? rawMessage : rawMessage.toString(),
				);
			} catch {
				ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
				return;
			}

			switch (msg.type) {
				case "join_room": {
					const { room } = msg;
					ws.subscribe(room);
					ws.data.rooms.add(room);

					// Send room history to newcomer
					const history = messageHistory.get(room) || [];
					ws.send(
						JSON.stringify({
							type: "room_joined",
							room,
							history,
						}),
					);

					// Notify room members
					ws.publish(
						room,
						JSON.stringify({
							type: "user_joined",
							room,
							username: ws.data.username,
							timestamp: Date.now(),
						}),
					);

					console.log(`${ws.data.username} joined #${room}`);
					break;
				}

				case "leave_room": {
					const { room } = msg;
					ws.unsubscribe(room);
					ws.data.rooms.delete(room);
					ws.data.isTyping.set(room, false);

					ws.publish(
						room,
						JSON.stringify({
							type: "user_left",
							room,
							username: ws.data.username,
							timestamp: Date.now(),
						}),
					);

					console.log(`${ws.data.username} left #${room}`);
					break;
				}

				case "chat": {
					const { room, text } = msg;

					// Validate message
					if (!ws.data.rooms.has(room)) {
						ws.send(
							JSON.stringify({
								type: "error",
								error: "You must join the room first",
							}),
						);
						return;
					}

					if (text.length > 2000) {
						ws.send(
							JSON.stringify({
								type: "error",
								error: "Message too long (max 2000 characters)",
							}),
						);
						return;
					}

					// Store in history
					addToHistory(room, ws.data.username, text);

					// Clear typing indicator
					ws.data.isTyping.set(room, false);

					// Broadcast to room including sender
					const chatPayload = JSON.stringify({
						type: "chat",
						room,
						username: ws.data.username,
						text,
						timestamp: Date.now(),
					});

					ws.publish(room, chatPayload);
					ws.send(chatPayload);
					break;
				}

				case "typing": {
					const { room, isTyping } = msg;

					if (!ws.data.rooms.has(room)) return;

					const wasTyping = ws.data.isTyping.get(room) || false;
					if (wasTyping === isTyping) return;

					ws.data.isTyping.set(room, isTyping);

					ws.publish(
						room,
						JSON.stringify({
							type: "typing",
							room,
							username: ws.data.username,
							isTyping,
						}),
					);
					break;
				}

				case "pong": {
					// Heartbeat response, client is alive
					break;
				}

				case "get_rooms": {
					ws.send(
						JSON.stringify({
							type: "room_list",
							rooms: Array.from(ws.data.rooms),
						}),
					);
					break;
				}

				default:
					ws.send(
						JSON.stringify({
							type: "error",
							error: "Unknown message type",
						}),
					);
			}
		},

		// Called when a client disconnects
		close(ws, code, reason) {
			// Notify all rooms the user was in
			for (const room of ws.data.rooms) {
				ws.publish(
					room,
					JSON.stringify({
						type: "user_left",
						room,
						username: ws.data.username,
						timestamp: Date.now(),
					}),
				);
			}

			clients.delete(ws.data.clientId);
			console.log(`${ws.data.username} disconnected (${clients.size} total)`);
		},

		// Configurable options
		maxPayloadLength: 64 * 1024, // 64KB max message size
		idleTimeout: 120, // Close idle connections after 2 minutes
		backpressureLimit: 1024 * 1024, // 1MB backpressure limit
	},
});

// Simple HTML chat client for testing
function getChatClientHtml(): string {
	return `<!DOCTYPE html>
<html>
<head>
  <title>Bun Chat</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    #messages { height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
    .message { margin: 5px 0; }
    .system { color: #888; font-style: italic; }
    input, button { padding: 8px; margin: 5px; }
  </style>
</head>
<body>
  <h1>Bun WebSocket Chat</h1>
  <div id="login">
    <input type="text" id="username" placeholder="Username">
    <button onclick="connect()">Connect</button>
  </div>
  <div id="chat" style="display:none">
    <div id="messages"></div>
    <input type="text" id="room" value="general" placeholder="Room">
    <button onclick="joinRoom()">Join Room</button>
    <br>
    <input type="text" id="message" placeholder="Message" onkeypress="if(event.key==='Enter')sendMessage()">
    <button onclick="sendMessage()">Send</button>
  </div>
  <script>
    let ws;
    function connect() {
      const username = document.getElementById('username').value;
      ws = new WebSocket('ws://localhost:8080/ws?username=' + username);
      ws.onopen = () => {
        document.getElementById('login').style.display = 'none';
        document.getElementById('chat').style.display = 'block';
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const div = document.createElement('div');
        div.className = 'message' + (data.type !== 'chat' ? ' system' : '');
        div.textContent = data.type === 'chat'
          ? data.username + ': ' + data.text
          : JSON.stringify(data);
        document.getElementById('messages').appendChild(div);
        document.getElementById('messages').scrollTop = 99999;
      };
    }
    function joinRoom() {
      ws.send(JSON.stringify({ type: 'join_room', room: document.getElementById('room').value }));
    }
    function sendMessage() {
      const input = document.getElementById('message');
      ws.send(JSON.stringify({ type: 'chat', room: document.getElementById('room').value, text: input.value }));
      input.value = '';
    }
  </script>
</body>
</html>`;
}

console.log(`Chat server running at http://localhost:${server.port}`);
