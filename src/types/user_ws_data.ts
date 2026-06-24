export interface UserWsData {
	clientId: string;
	username: string;
	rooms: Set<string>;
	joinedAt: Map<string, Date>;
	isTyping: Map<string, boolean>;
}
