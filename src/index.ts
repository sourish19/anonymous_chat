import { wsUpgradeHandler } from "./wsRoutes";

const PORT = Number(Bun.env.PORT);

const app = Bun.serve({
	port: PORT,
	fetch(req, server) {
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
	},
	websocket: {
		async message(ws, message) {
			const msg = String(message);
			console.log(msg);
			if (msg == "ping") ws.send("pong");
		},
	},
});
console.log(`Server is running on ${app.url}`);
