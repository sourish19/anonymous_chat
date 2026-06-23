import type { ServerWebSocket } from "bun";
import type { UserData } from "../types/user_chat_data";

class RoomManager {
	private roomOwners = new Map<string, string>();
	private roomMembers = new Map<string, Set<string>>();
	private rooms = new Set<{ roomId: string; roomName: string }>();

	createRoom = (ws: ServerWebSocket<UserData>, roomName: string) => {
		if (this.roomExists(roomName){
			ws.send(JSON.stringify({
				
			}))
		}
	};
	joinRoom = () => {};
	leaveRoom = () => {};
	leaveAllRoom = () => {};
	getAllMembers = () => {};
	getAllRooms = () => {
		let data: { roomId: string; roomName: string }[] = [];
		for (const val of this.rooms) {
			data.push({ roomId: val.roomId, roomName: val.roomName });
		}
		return {
			total: this.rooms.size,
			rooms: data,
		};
	};
	roomExists = (roomName: string) => {
		let exists: boolean = false;

		for (const room of this.rooms) {
			if (roomName == room.roomName) {
				exists = true;
				break;
			}
		}

		return exists;
	};
	userExistsInRoom = () => {};
	deleteRoom = () => {};
	getRoomCount = () => {};
}

export const roomManager = new RoomManager();
