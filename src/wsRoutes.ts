import type { Server } from "bun";

type WSContext = {
	data: {
		user_id: string;
	};
};

export const wsUpgradeHandler = (req: Request, server: Server<undefined>) => {
	const url = new URL(req.url);

	switch (url.pathname) {
		case "/ping": {
			const success = server.upgrade(req);
			if (success) return undefined;
			return new Response("Upgrade Failed", { status: 400 });
		}
		case "/pong": {
			const success = server.upgrade(req);
			if (success) return undefined;
			return new Response("Upgrade Failed", { status: 400 });
		}
	}
};
