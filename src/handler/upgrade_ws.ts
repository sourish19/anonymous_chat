import { generateUserName } from "../utils/generate_user_name";

import type { Server } from "bun";
import type { UserWsData } from "../types/user_ws_data";

export const wsUpgradeHandler = async (
	req: Request,
	server: Server<UserWsData>,
) => {
	// TODO: can do auth check here before upgrading
	const wsData: UserWsData = {
		username: await generateUserName(),
		clientId: Bun.randomUUIDv7(),
		rooms: new Set(),
		joinedAt: new Map(),
		isTyping: new Map(),
	};

	const success = server.upgrade(req, {
		data: wsData,
	});

	return success ? undefined : new Response("Upgrade failed", { status: 400 });
};
