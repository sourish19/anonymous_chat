import { wsResponse } from "../utils/response";
import { WsErrorCodes } from "../utils/ws_error";
import { clients } from "..";

import type { ServerWebSocket } from "bun";
import type { UserData } from "../types/user_chat_data";
import type { ServerMessage } from "../types/server_mssg";

class RoomManager {
	private rooms = new Map<string, string>(); //roomId,roomName
	private roomOwners = new Map<string, string>(); // roomId,clientId
	private roomMembers = new Map<string, Set<string>>(); // roomId, [clientId]

	createRoom = (ws: ServerWebSocket<UserData>, roomName: string) => {
		if (this.roomExistsByName(roomName)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.ROOM_EXISTS,
				`Room with ${roomName} already exists `,
			);
		}
		const roomId = Bun.randomUUIDv7();

		this.rooms.set(roomId, roomName);

		this.roomOwners.set(roomId, ws.data.clientId);

		this.roomMembers.set(roomId, new Set([ws.data.clientId]));

		ws.data.rooms.add(roomId);

		ws.subscribe(roomId);

		return wsResponse.sendMssg(ws, { type: "room_created", roomId, roomName });
	};

	joinRoom = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.ROOM_NOT_FOUND,
				`Room with ${roomId} dosen't exists `,
			);
		}

		if (this.isRoomMember(ws, roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.ALREADY_IN_ROOM,
				`Already a room member`,
			);
		}

		ws.data.rooms.add(roomId);

		ws.subscribe(roomId);

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

		this.roomMembers.get(roomId)?.add(ws.data.clientId);

		return wsResponse.sendMssg(ws, {
			type: "room_joined",
			roomId,
			memberCount: this.roomMembers.get(roomId)?.size!,
		});
	};

	leaveRoom = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.ROOM_NOT_FOUND,
				`Room with ${roomId} dosen't exists `,
			);
		}

		if (!this.isRoomMember(ws, roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.NOT_IN_ROOM,
				`Not a room member`,
			);
		}

		if (this.isRoomOwner(ws, roomId)) {
			return this.deleteRoom(ws, roomId);
		}

		const members = this.roomMembers.get(roomId);

		// INFO: delete a particular client from room members
		members?.delete(ws.data.clientId);

		const response: ServerMessage = {
			type: "user_left",
			roomId,
			username: ws.data.username,
		};

		ws.publish(roomId, JSON.stringify(response));

		ws.unsubscribe(roomId);

		ws.data.rooms.delete(roomId);

		return wsResponse.sendMssg(ws, { type: "room_left", roomId });
	};

	leaveAllRoom = () => {};

	// getAllMembers = (ws: ServerWebSocket<UserData>, roomId: string) => {
	// 	if (!this.roomExistsById(roomId)) {
	// 		wsResponse.error(
	// 			ws,
	// 			WsErrorCodes.ROOM_EXISTS,
	// 			`Room with ${roomId} dosen't exists `,
	// 		);
	// 	}

	// 	wsResponse.sendMssg(ws, { type: "all_users", users });
	// };

	getAllRooms = (ws: ServerWebSocket<UserData>) => {
		const rooms = Array.from(this.rooms.entries()).map(([key, id]) => {
			return {
				roomId: key,
				roomName: id,
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

	deleteRoom = (ws: ServerWebSocket<UserData>, roomId: string) => {
		if (!this.rooms.has(roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.ROOM_NOT_FOUND,
				`Room with ${roomId} dosen't exists `,
			);
		}

		if (!this.isRoomOwner(ws, roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.UNAUTHORIZED,
				`Not a room owner `,
			);
		}

		const roomName = this.rooms.get(roomId)!;

		const response: ServerMessage = {
			type: "room_delete",
			roomName,
		};

		ws.publish(roomId, JSON.stringify(response));

		ws.data.rooms.delete(roomId);

		// INFO: unsubscribing each client from room & also deleting from rooms
		this.roomMembers.get(roomId)?.forEach((id) => {
			const client = clients.get(id);
			client?.unsubscribe(roomId);
			client?.data.rooms.delete(roomId);
		});

		this.rooms.delete(roomId);
		this.roomOwners.delete(roomId);
		this.roomMembers.delete(roomId);

		return wsResponse.sendMssg(ws, { type: "room_delete", roomName });
	};

	// INFO: *************** Utilities methods ***************

	getRoomCount = () => {
		const count = this.rooms.size;

		if (count == undefined) return 0;

		return count;
	};

	isRoomOwner = (ws: ServerWebSocket<UserData>, roomId: string) => {
		const owner = this.roomOwners.get(roomId);

		if (owner != ws.data.clientId || owner == undefined) return false;

		return true;
	};

	isRoomMember = (ws: ServerWebSocket<UserData>, roomId: string) => {
		const member = this.roomMembers.get(roomId);

		if (member?.size == 0 || member == undefined) return false;

		return member.has(ws.data.clientId);
	};
}

export const roomManager = new RoomManager();
