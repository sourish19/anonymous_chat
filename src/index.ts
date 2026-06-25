import { wsUpgradeHandler } from "./handler/upgrade_ws";
import { roomManager } from "./services/room_manager";

import type { ServerWebSocket } from "bun";
import type { UserWsData } from "./types/user_ws_data";
import { connectionManager } from "./services/connection_manager";
import { wsResponse } from "./utils/response";
import { WsErrorCodes } from "./utils/ws_error";

const PORT = Number(Bun.env.PORT);

export const clients = new Map<string, ServerWebSocket<UserWsData>>(); // clientId {clientId,username,...}

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
		data: {} as UserWsData,

		open(ws) {
			// TODO: dont know if this chair is required or  not
			if (connectionManager.getAllClients()) {
				return wsResponse.error(
					ws,
					WsErrorCodes.INVALID_PAYLOAD,
					"Client with this id is already connected",
				);
			}

			connectionManager.addClient(ws);

			console.log(`${ws.data.username} connected (${connectionManager.getClientsCount()} total)`);
		},

		message(ws, message) {
			
		},

		close(ws) {},
	},
});

console.log(`Server is running on ${app.url}`);
