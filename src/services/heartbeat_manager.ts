import { connectionManager } from "./connection_manager";
import { roomManager } from "../../roommanager";

import type { ServerWebSocket } from "bun";
import type { UserWsData } from "../types/user_ws_data";
import type { ServerMessage } from "../types/server_mssg";

interface HeartBeatConfig {
	pingInterval: number;
	pongTimeout: number;
}

const DEFAULT_CONFIG: HeartBeatConfig = {
	pingInterval: Number(Bun.env.PingInterval) || 30000,
	pongTimeout: Number(Bun.env.PongInterval) || 10000,
};

// INFO: automatically removes stale connections
class HeartBeatManager {
	private config: HeartBeatConfig;
	private pingIntervals = new Map<string, Timer>(); // clientId, intervalId
	private pendingPongs = new Map<string, Timer>(); // clientId,  timerId

	constructor(config: Partial<HeartBeatConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	startHeartBeat = (ws: ServerWebSocket<UserWsData>) => {
		const clientId = ws.data.clientId;

		// INFO: if by any chance startHeartBeat is called more than once so it shouldn't create another interval. guard againt double starting
		if (this.pingIntervals.has(clientId)) return;

		/*  INFO: Start the interval */
		const intervalId = setInterval(() => {
			// INFO: If client is not in open state then just stop the heartbeat
			if (ws.readyState !== 1) {
				this.stopHeartBeat(clientId);
				return;
			}

			// INFO: if timer by any chance exists then clear it
			const existingTimer = this.pendingPongs.get(clientId);
			if (existingTimer) clearTimeout(existingTimer);

			const mssg: ServerMessage = {
				type: "PING",
				timestamp: Date.now(),
			};

			// INFO: send PING to client
			try {
				ws.send(JSON.stringify(mssg));
			} catch (err) {
				console.error(`Failed to send ping to ${clientId}:`, err);
				this.stopHeartBeat(clientId);
			}

			// INFO: this will only run when the client dosent send PONG back
			const timerId = setTimeout(() => {
				console.log(`Client ${clientId} heartbeat timeout, closing connection`);

				// INFO: cleanup & close all the connections
				this.stopHeartBeat(clientId);

				connectionManager.removeClient(clientId);

				roomManager.leaveAllRooms(ws);

				ws.close(1000, "Heartbeat timeout");
			}, this.config.pongTimeout);

			this.pendingPongs.set(clientId, timerId);
		}, this.config.pingInterval);

		this.pingIntervals.set(clientId, intervalId);
		console.log(`Heartbeat started for client ${clientId}`);
	};

	// INFO: clear the interval & timer
	stopHeartBeat = (clientId: string) => {
		const intervalId = this.pingIntervals.get(clientId);
		const timerId = this.pendingPongs.get(clientId);

		if (intervalId) {
			clearInterval(intervalId);
			this.pingIntervals.delete(clientId);
		}

		if (timerId) {
			clearTimeout(timerId);
			this.pendingPongs.delete(clientId);
		}

		console.log(`Heartbeat stopped for client ${clientId}`);
	};

	receivedPong = (clientId: string) => {
		const timerId = this.pendingPongs.get(clientId);

		if (timerId) {
			clearTimeout(timerId);
			this.pendingPongs.delete(clientId);
		}
	};
}

export const heartBeatManager = new HeartBeatManager();

// server -> ping (30s)
// server <- pong (withing 10s) ok then again the 30s will start from here
// disconnect
