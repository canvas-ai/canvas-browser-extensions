import React from 'react';
import styles from "./DisconnectedState.module.scss";
import { browser, cx } from '../utils';
import { setRetrying } from '../redux/variables/varActions';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { RUNTIME_MESSAGES } from '@/general/constants';

interface DisconnectedStateTypes {
  connectionHost: string;
  setConnectionDetailsClicked: React.MouseEventHandler<HTMLButtonElement>;
}

const DisconnectedState: React.FC<DisconnectedStateTypes> = ({ connectionHost, setConnectionDetailsClicked }) => {
  const dispatch = useDispatch<any>();
  const variables = useSelector((state: { variables: IVarState }) => state.variables);
  const retryConnection = () => {
    dispatch(setRetrying(true));
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
  }

  return (
    <section className={cx('no-pad', styles.disconnectedState)}>
      <div className={styles.disconnectedContent}>
        <div className={styles.stateDescription}>
          { variables.retrying ? (
            <div className={styles.messageContainer}>
              <strong>Retrying...</strong>
            </div>
          ) : (
            <div className={styles.messageContainer}>
              <strong>Couldn&apos;t connect to the {connectionHost} host.</strong>
            </div>
          ) }
          <div className={styles.connectionDetailsButtonContainer}>
            <button onClick={() => retryConnection()} disabled={variables.retrying} className="btn red waves-effect waves-light">Retry Connection</button>
            <button onClick={setConnectionDetailsClicked} className="btn-flat blue-text text-darken-1">Set connection details</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DisconnectedState;