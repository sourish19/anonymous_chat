import { wsResponse } from "../utils/response";
import { WsErrorCodes } from "../utils/ws_error";
import { connectionManager } from "./connection_manager";

import type { ServerWebSocket } from "bun";
import type { UserWsData } from "../types/user_ws_data";
import type { ServerMessage } from "../types/server_mssg";

class RoomManager {
	private rooms = new Map<string, string>(); //roomId,roomName
	private roomOwners = new Map<string, string>(); // roomId,clientId
	private roomMembers = new Map<string, Set<string>>(); // roomId, [clientId]

	createRoom = (ws: ServerWebSocket<UserWsData>, roomName: string) => {
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

	joinRoom = (ws: ServerWebSocket<UserWsData>, roomId: string) => {
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

		const members = this.roomMembers.get(roomId);

		members?.add(ws.data.clientId);

		ws.publish(
			roomId,
			JSON.stringify({
				type: "user_joined",
				room: this.rooms.get(roomId),
				username: ws.data.username,
				timeStamp: Date.now(),
			}),
		);

		return wsResponse.sendMssg(ws, {
			type: "room_joined",
			roomId,
			memberCount: members?.size!,
		});
	};

	leaveRoom = (ws: ServerWebSocket<UserWsData>, roomId: string) => {
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

		ws.unsubscribe(roomId);

		ws.data.rooms.delete(roomId);

		const response: ServerMessage = {
			type: "user_left",
			roomId,
			username: ws.data.username,
		};

		ws.publish(roomId, JSON.stringify(response));

		return wsResponse.sendMssg(ws, { type: "room_left", roomId });
	};

	// INFO: this is a internal method client will never hit this
	leaveAllRooms = (ws: ServerWebSocket<UserWsData>) => {
		const clientId = ws.data.clientId;
		const roomIds = Array.from(ws.data.rooms);

		for (const id of roomIds) {
			if (this.isRoomOwner(ws, id)) {
				this.deleteRoom(ws, id);
			} else {
				this.leaveRoom(ws, id);
			}
		}

		connectionManager.removeClient(clientId);
		return;
	};

	getAllMembersOfRoom = (ws: ServerWebSocket<UserWsData>, roomId: string) => {
		if (!this.roomExistsById(roomId)) {
			return wsResponse.error(
				ws,
				WsErrorCodes.ROOM_NOT_FOUND,
				`Room with ${roomId} dosen't exists `,
			);
		}

		const clients = this.roomMembers.get(roomId);

		if (!clients || clients?.size == 0) {
			return wsResponse.error(
				ws,
				WsErrorCodes.MEMBERS_NOT_FOUND,
				`No member is connected in ${roomId}`,
			);
		}

		const users = Array.from(clients).map((val) => {
			return {
				clientId: val,
				userName: connectionManager.getClient(val)?.data.username!,
			};
		});

		wsResponse.sendMssg(ws, { type: "all_users", users });
	};

	getAllRooms = (ws: ServerWebSocket<UserWsData>) => {
		const rooms: { roomId: string; roomName: string }[] = [];

		for (const [key, val] of this.rooms.entries()) {
			rooms.push({
				roomId: key,
				roomName: val,
			});
		}

		return wsResponse.sendMssg(ws, { type: "room_list", rooms });
	};

	deleteRoom = (ws: ServerWebSocket<UserWsData>, roomId: string) => {
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

		// ws.data.rooms.delete(roomId); // in the below loop all the clients gets deleted from the rooms

		const roomMembers = this.roomMembers;

		// INFO: unsubscribing each client from room & also deleting from rooms
		roomMembers.get(roomId)?.forEach((id) => {
			const client = connectionManager.getClient(id);
			client?.unsubscribe(roomId);
			client?.data.rooms.delete(roomId);
		});

		this.rooms.delete(roomId);
		this.roomOwners.delete(roomId);
		roomMembers.delete(roomId);

		return wsResponse.sendMssg(ws, { type: "room_delete", roomName });
	};

	// INFO: *************** Utilities methods ***************

	roomExistsByName = (roomName: string) => {
		for (const val of this.rooms.values()) {
			if (val === roomName) {
				return true;
			}
		}

		// const exists = this.rooms.values().toArray().includes(roomName);

		return false;
	};

	roomExistsById = (roomId: string) => {
		const exists = this.rooms.has(roomId);

		return exists;
	};

	getRoomCount = () => {
		const count = this.rooms.size;

		return count;
	};

	isRoomOwner = (ws: ServerWebSocket<UserWsData>, roomId: string) => {
		const owner = this.roomOwners.get(roomId);

		if (!owner || owner != ws.data.clientId) return false;

		return true;
	};

	isRoomMember = (ws: ServerWebSocket<UserWsData>, roomId: string) => {
		const member = this.roomMembers.get(roomId);

		if (!member || member.size == 0) return false;

		return member.has(ws.data.clientId);
	};
}

export const roomManager = new RoomManager();
