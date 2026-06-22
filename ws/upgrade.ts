import type { Server } from "bun";

type WSContext = {
	route: string;
};

export const wsUpgradeHandler = (
	req: Request,
	server: Server<WSContext>,
	route: string,
) => {
	const url = new URL(req.url);

	switch (url.pathname) {
		case "/ping": {
			const success = server.upgrade(req, {
				data: {
					route,
				},
			});
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
