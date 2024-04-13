import { SET_CONNECTED, SET_CONTEXT, SET_RETRYING, VariableActionTypes } from "./varActionTypes";

const DEFAULT_STATE = {
  connected: false,
  context: {
    url: "universe:///",
    color: "#fff"
  },
  retrying: false
}

const varReducer = (state = DEFAULT_STATE, action: VariableActionTypes): IVarState => {
  switch (action.type) {
    case SET_CONNECTED:
      return {
        ...state,
        connected: action.payload,
      };
    case SET_CONTEXT:
      return {
        ...state,
        context: action.payload,
      };
    case SET_RETRYING:
      return {
        ...state,
        retrying: action.payload
      }
    default:
      return state;
  }
};


export default varReducer;
