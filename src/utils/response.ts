import type { ServerWebSocket } from "bun";
import type { UserData } from "../types/user_ws_data";
import type { WsErrorCodes } from "./ws_error";
import type { ServerMessage } from "../types/server_mssg";

class WsResponse {
	sendMssg = (ws: ServerWebSocket<UserData>, mssg: ServerMessage) => {
		ws.send(JSON.stringify(mssg));
	};
	error = (
		ws: ServerWebSocket<UserData>,
		code: WsErrorCodes,
		message: string,
	) => {
		this.sendMssg(ws, { type: "error", code, message });
	};
}

export const wsResponse = new WsResponse();
