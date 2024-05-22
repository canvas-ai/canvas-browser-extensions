import config from "@/general/config"
import { getSocket } from "./socket";
import { RUNTIME_MESSAGES, SOCKET_MESSAGES } from "@/general/constants";
import { sendRuntimeMessage } from "./utils";

export let sessions: ISession[] = [];
export let selectedSession: ISession = config.session;

export const createSession = () => {
  return new Promise(async (resolve, reject) => {
    await config.load();
    const socket = await getSocket();
    selectedSession = {
      id: config.session.id || 'default',
      baseUrl: config.session.baseUrl
    };
    socket.emit(SOCKET_MESSAGES.SESSION.CREATE, selectedSession.id, { baseUrl: selectedSession.baseUrl }, (res) => {
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
        sessions = res.payload as ISession[];
        selectedSession = sessions.find(s => s.id === selectedSession.id) as ISession;
        selectedSession.contexts = selectedSession.contexts || {};
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.update_sessions_list, payload: sessions });
        resolve(sessions);
      }
    });
  });

}