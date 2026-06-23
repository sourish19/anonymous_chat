import { wsUpgradeHandler } from "./handler/upgrade_ws";
import { roomManager } from "./services/room_manager";

import type { ServerWebSocket } from "bun";
import type { UserData } from "./types/user_chat_data";

const PORT = Number(Bun.env.PORT);

const clients = new Map<string, ServerWebSocket<UserData>>();

const app = Bun.serve({
	port: PORT,
	fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname == "/ws") return wsUpgradeHandler(req, server);
		return new Response(
			JSON.stringify({ success: true, message: `User hit ${req.url}` }),
		);
	},
	websocket: {
		data: {} as UserData,

		open(ws) {
			clients.set(ws.data.clientId, ws);

			ws.send(
				JSON.stringify({
					type: "welcome",
					clientId: ws.data.clientId,
					username: ws.data.username,
					message: "Welcome to annonymous chat app",
					rooms: roomManager.getAllRooms(),
				}),
			);

			console.log(`${ws.data.username} connected (${clients.size} total)`);
		},

		message(ws, message) {},

		close(ws) {},
	},
});

console.log(`Server is running on ${app.url}`);
