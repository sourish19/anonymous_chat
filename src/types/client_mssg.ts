export type UserChatMssg =
	| { type: "joined_room"; roomId: string }
	| { type: "leave_room"; roomId: string }
	| { type: "chat"; roomId: string; text: string }
	| { type: "typing"; roomId: string; isTyping: boolean }
	| { type: "heartbeat" }
	| { type: "get_rooms" };
