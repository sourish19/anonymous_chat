import { WsErrorCodes } from "../utils/ws_error";

export type ServerMessage =
	// room events
	| { type: "room_joined"; roomId: string; memberCount: number }
	| { type: "room_created"; roomId: string; roomName: string }
	| { type: "room_left"; roomId: string }
	| { type: "room_list"; rooms: { roomId: string; roomName: string }[] }
	| { type: "room_count"; count: number }
	| { type: "room_delete"; roomName: string }
	// chat events
	| {
			type: "chat";
			roomId: string;
			text: string;
			username: string;
			timestamp: number;
	  }
	| { type: "user_joined"; roomId: string; username: string }
	| { type: "user_left"; roomId: string; username: string }
	// typing
	| { type: "typing"; roomId: string; username: string; isTyping: boolean }
	// system
	| { type: "heartbeat_ack" }
	| { type: "error"; code: WsErrorCodes; message: string }
	| { type: "welcome"; clientId: string; username: string };
