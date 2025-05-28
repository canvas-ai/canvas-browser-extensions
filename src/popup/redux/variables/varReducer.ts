import { SET_CONNECTED, SET_RETRYING, VariableActionTypes } from "./varActionTypes";

interface IMinimalVarState {
  connected: boolean;
  retrying: boolean;
}

const DEFAULT_STATE: IMinimalVarState = {
  connected: false,
  retrying: false
}

const varReducer = (state = DEFAULT_STATE, action: VariableActionTypes): IMinimalVarState => {
  switch (action.type) {
    case SET_CONNECTED:
      return {
        ...state,
        connected: action.payload,
      };
    case SET_RETRYING:
      return {
        ...state,
        retrying: action.payload
      };
    default:
      return state;
  }
};

export default varReducer;
