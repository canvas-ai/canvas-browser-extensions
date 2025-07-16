import config from "@/general/config"
import { sendRuntimeMessage } from "./utils";
import { RUNTIME_MESSAGES } from "@/general/constants";

let sessions: ISession[] = [];
let selectedSession: ISession = {
  id: 'default',
  baseUrl: '/'
};

// Session management should be handled via REST API or local storage
// For now, we'll use a simple local implementation
export const createSession = () => {
  return new Promise(async (resolve, reject) => {
    try {
      await config.load();
      selectedSession = {
        id: config.session.id || 'default',
        baseUrl: config.session.baseUrl || '/'
      };

      // For now, just resolve with a local session
      // This could be enhanced to use REST API if session management is implemented
      console.log("background.js | Local session created: ", selectedSession);
      resolve({ status: 'success', payload: selectedSession });
    } catch (error) {
      console.error("background.js | Error creating local session: ", error);
      reject(error);
    }
  });
};

export const updateSessionsList = () => {
  return new Promise(async (resolve, reject) => {
    try {
      await config.load();

      // For now, use local session management
      // This could be enhanced to fetch from REST API if needed
      sessions = [selectedSession];
      selectedSession.contexts = selectedSession.contexts || {};

      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.update_sessions_list,
        payload: sessions
      });

      console.log("background.js | Local sessions list updated: ", sessions);
      resolve(sessions);
    } catch (error) {
      console.error("background.js | Error updating sessions list: ", error);
      reject(error);
    }
  });
};
