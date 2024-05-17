import config from "@/general/config"
import { getSocket } from "./socket";
import { RUNTIME_MESSAGES, SOCKET_MESSAGES } from "@/general/constants";
import { sendRuntimeMessage } from "./utils";

export const createSession = () => {
  return new Promise(async (resolve, reject) => {
    await config.load();
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.SESSION.CREATE, config.session.id || 'default', { baseUrl: config.session.baseUrl || '/' }, (res) => {
      if (res.status === "error") {
        console.error("background.js | Error creating session: ", res);
        reject("background.js | Error creating session: " + res.message);
      } else {
        console.log("background.js | Create session response: ", res);
        resolve(res);
      }
    });
  });
}

export const updateSessionsList = () => {
  return new Promise(async (resolve, reject) => {
    await config.load();
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.SESSION.LIST, {}, (res) => {
      if (res.status === "error") {
        console.error("background.js | Error updating session list: ", res);
        reject("background.js | Error creating session: " + res.message);
      } else {
        console.log("background.js | Updating session list response: ", res);
        const sessions = res.payload as ISession[];
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.update_sessions_list, payload: sessions });
        resolve(sessions);
      }
    });
  });

}