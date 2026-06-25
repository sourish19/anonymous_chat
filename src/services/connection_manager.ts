import type { ServerWebSocket } from "bun";
import type { UserWsData } from "../types/user_ws_data";
import type { ServerMessage } from "../types/server_mssg";

// INFO: this class is used to manage all the conected clients to the Ws
class ConnectionManager {
	private clients = new Map<string, ServerWebSocket<UserWsData>>(); // clientId, {UserWsData}}

	addClient = (ws: ServerWebSocket<UserWsData>) => {
		this.clients.set(ws.data.clientId, ws);
		return ws.data.clientId;
	};

	getClient = (clientId: string) => {
		return this.clients.get(clientId);
	};

	getAllClients = () => {
		return Array.from(this.clients.values());
	};

	getClientsCount = () => {
		return this.clients.size;
	};

	removeClient = (clientId: string) => {
		return this.clients.delete(clientId);
	};

	// INFO: if excluded ids is large better to convert excludeIds to a set
	broadcastToAllClients = (message: ServerMessage, excludeIds?: string[]) => {
		const payload = JSON.stringify(message);
		let filteredClients: [string, ServerWebSocket<UserWsData>][] = [];

		if (!excludeIds || excludeIds.length === 0) {
			filteredClients = Array.from(this.clients);
		} else {
			filteredClients = Array.from(this.clients).filter(
				([id, _]) => !excludeIds.includes(id),
			);
		}

		filteredClients.forEach(
			([_, client]) => client.readyState === 1 && client.send(payload),
		);
	};
}

export const connectionManager = new ConnectionManager();
