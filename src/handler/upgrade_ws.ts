import { generateUserName } from "../utils/generate_user_name";

import type { Server } from "bun";
import type { UserData } from "../types/user_chat_data";

export const wsUpgradeHandler = async (
	req: Request,
	server: Server<UserData>,
) => {
	const success = server.upgrade(req, {
		data: {
			userId: Bun.randomUUIDv7(),
			username: await generateUserName(),
			clientId: Bun.randomUUIDv7(),
			rooms: new Set(),
			joinedAt: new Map(),
			isTyping: new Map(),
		},
	});

	return success ? undefined : new Response("Upgrade failed", { status: 400 });
};
