export interface UserChatData {
	userId: string;
	username: string;
	clientId: string;
	rooms: Set<string>;
	joinedAt: Date;
	isTyping: Map<string, boolean>;
}
