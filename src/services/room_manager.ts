import { wsResponse } from "../utils/response";
import { WsErrorCodes } from "../utils/ws_error";

import type { ServerWebSocket } from "bun";
import type { UserData } from "../types/user_chat_data";

class RoomManager {
	private rooms = new Map<string, string>(); //roomId,roomName
	private roomOwners = new Map<string, string>(); // roomId,clientId
	private roomMembers = new Map<string, Set<string>>(); // roomId, [clientId]

	createRoom = (ws: ServerWebSocket<UserData>, roomName: string) => {
		if (this.roomExists(roomName)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ROOM_EXISTS,
				`Room with ${roomName} already exists `,
			);
		}
		const roomId = Bun.randomUUIDv7();

		this.rooms.set(roomId, roomName);

		this.roomOwners.set(roomId, ws.data.clientId);

		wsResponse.sendMssg(ws, { type: "room_created", roomId, roomName });
	};

	joinRoom = () => {};

	leaveRoom = () => {};
	leaveAllRoom = () => {};
	getAllMembers = () => {};

	getAllRooms = (ws: ServerWebSocket<UserData>) => {
		const rooms = Array.from(this.rooms.entries()).map(([key, val]) => {
			return {
				roomId: key,
				roomName: val,
			};
		});

		wsResponse.sendMssg(ws, { type: "room_list", rooms });
	};

	roomExists = (roomName: string) => {
		const exists = Array.from(this.rooms.values()).includes(roomName);

		return exists;
	};

	userExistsInRoom = () => {};

	deleteRoom = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.rooms.has(roomId)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ROOM_NOT_FOUND,
				`Room with ${roomId} dosen't exists `,
			);
		}

		const owner = this.roomOwners.get(roomId);

		if (owner == ws.data.clientId) {
			wsResponse.error(ws, WsErrorCodes.UNAUTHORIZED, `Not a room owner`);
		}

		this.rooms.delete(roomId);

		this.roomOwners.delete(roomId);

		this.roomMembers.delete(roomId);
	};

	getRoomCount = (ws: ServerWebSocket<UserData>) => {
		const count = this.rooms.size;

		wsResponse.sendMssg(ws, { type: "room_count", count });
	};
}

export const roomManager = new RoomManager();
