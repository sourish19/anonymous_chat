import type { Server } from "bun";
import type { UserData } from "../types/user_chat_data";

export const wsUpgradeHandler = (req: Request, server: Server<UserData>) => {
	const success = server.upgrade(req, {
		data: {
			userId: "12121",
			username: "hello",
			clientId: "9898",
			rooms: new Set(),
			joinedAt: new Map(),
			isTyping: new Map(),
		},
	});

	return success ? undefined : new Response("Upgrade failed", { status: 400 });
};
