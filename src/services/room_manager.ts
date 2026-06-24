import { wsResponse } from "../utils/response";
import { WsErrorCodes } from "../utils/ws_error";

import type { ServerWebSocket } from "bun";
import type { UserData } from "../types/user_chat_data";
import type { ServerMessage } from "../types/server_mssg";

class RoomManager {
	private rooms = new Map<string, string>(); //roomId,roomName
	private roomOwners = new Map<string, string>(); // roomId,clientId
	private roomMembers = new Map<string, Set<string>>(); // roomId, [clientId]

	createRoom = (ws: ServerWebSocket<UserData>, roomName: string) => {
		if (this.roomExistsByName(roomName)) {
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

	joinRoom = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ROOM_EXISTS,
				`Room with ${roomId} dosen't exists `,
			);
		}

		if (this.isRoomOwner(ws, roomId)) {
			wsResponse.error(ws, WsErrorCodes.ALREADY_IN_ROOM, `Room owner`);
		}

		if (this.isRoomMember(ws, roomId)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ALREADY_IN_ROOM,
				`Already a room member`,
			);
		}

		ws.publish(
			roomId,
			JSON.stringify({
				type: "user_joined",
				room: this.rooms.get(roomId),
				userId: ws.data.userId,
				username: ws.data.username,
				timeStamp: Date.now(),
			}),
		);

		wsResponse.sendMssg(ws, {
			type: "room_joined",
			roomId,
			memberCount: this.rooms.size,
		});
	};

	isRoomOwner = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ROOM_EXISTS,
				`Room with ${roomId} dosen't exists `,
			);
		}

		const owner = this.roomOwners.get(roomId);

		if (owner == ws.data.clientId) return true;

		return false;
	};

	isRoomMember = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ROOM_EXISTS,
				`Room with ${roomId} dosen't exists `,
			);
		}

		const member = this.roomMembers.get(roomId);

		return member?.has(ws.data.clientId);
	};

	leaveRoom = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			wsResponse.error(
				ws,
				WsErrorCodes.ROOM_EXISTS,
				`Room with ${roomId} dosen't exists `,
			);
		}

		if (this.isRoomOwner(ws, roomId)) {
			this.roomOwners.delete(roomId);
			this.rooms.delete(roomId);
			this.roomMembers.delete(roomId);
		}

		if (!this.isRoomMember(ws, roomId)) {
			wsResponse.error(ws, WsErrorCodes.NOT_IN_ROOM, `Not a room member`);
		}

		const members = this.roomMembers.get(roomId);

		members?.delete(ws.data.clientId);

		const response: ServerMessage = {
			type: "user_left",
			roomId,
			username: ws.data.username,
		};

		ws.publish(roomId, JSON.stringify(response));

		wsResponse.sendMssg(ws, { type: "room_left", roomId });
	};

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

	roomExistsByName = (roomName: string) => {
		const exists = Array.from(this.rooms.values()).includes(roomName);

		return exists;
	};

	roomExistsById = (roomId: string) => {
		const exists = this.rooms.has(roomId);

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

		if (!this.isRoomOwner(ws, roomId)) {
			wsResponse.error(ws, WsErrorCodes.UNAUTHORIZED, `Not a room owner `);
		}

		const roomName = this.rooms.get(roomId)!;

		this.rooms.delete(roomId);

		this.roomOwners.delete(roomId);

		this.roomMembers.delete(roomId);

		wsResponse.sendMssg(ws, { type: "room_delete", roomName });
	};

	getRoomCount = (ws: ServerWebSocket<UserData>) => {
		const count = this.rooms.size;

		wsResponse.sendMssg(ws, { type: "room_count", count });
	};
}

export const roomManager = new RoomManager();
