import React, { useState } from 'react';
import cx from 'classnames';
import styles from "./DisconnectedState.module.scss";

interface DisconnectedStateTypes {
  connectionHost: string;
  setConnectionDetailsClicked: React.MouseEventHandler<HTMLButtonElement>;
  retrying: boolean;
  setRetrying: React.Dispatch<React.SetStateAction<boolean>>;
}

const DisconnectedState: React.FC<DisconnectedStateTypes> = ({ connectionHost, setConnectionDetailsClicked, setRetrying, retrying }) => {
  const retryConnection = () => {
    setRetrying(true);
    chrome.runtime.sendMessage({ action: 'socket:retry' });
  }

  return (
    <section className={cx('no-pad', styles.disconnectedState)}>
      <div className={styles.disconnectedContent}>
        <div className={styles.stateDescription}>
          { retrying ? (
            <div className={styles.messageContainer}>
              <strong>Retrying...</strong>
            </div>
          ) : (
            <div className={styles.messageContainer}>
              <strong>Couldn&apos;t connect to the {connectionHost} host.</strong>
            </div>
          ) }
          <div className={styles.connectionDetailsButtonContainer}>
            <button onClick={() => retryConnection()} disabled={retrying} className="btn red waves-effect waves-light">Retry Connection</button>
            <button onClick={setConnectionDetailsClicked} className="btn-flat blue-text text-darken-1">Set connection details</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DisconnectedState;