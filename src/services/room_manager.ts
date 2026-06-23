class RoomManager {
	private roomOwners = new Map<string, string>();
	private roomMembers = new Map<string, Set<string>>();
	private rooms = new Set<{ roomId: string; roomName: string }>();

	createRoom = () => {};
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
	roomExists = () => {};
	userExistsInRoom = () => {};
	deleteRoom = () => {};
	getRoomCount = () => {};
}

export const roomManager = new RoomManager();
