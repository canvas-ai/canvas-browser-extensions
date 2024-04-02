import React, { useEffect, useState } from 'react';
import cx from 'classnames';
import styles from "./ConnectionPopup.module.css";
import { setConfig } from 'dompurify';
import ConnectionSettingsForm from './ConnectionSettingsForm';

interface ConnectionPopupTypes {
  open: boolean;
  closePopup: React.MouseEventHandler<HTMLDivElement>;
  retrying: boolean;
}

const ConnectionPopup: React.FC<ConnectionPopupTypes> = ({ open, closePopup, retrying }) => {
  return (
    <div className={["popup-container", ...(open ? ["popup-opened"] : [])].join(" ")}>
        <div className="popup-overlay" onClick={closePopup}></div>
        <div className="popup-content connection-settings-popup">
          <ConnectionSettingsForm retrying={retrying} closePopup={closePopup} />
        </div>
      </div>
  );
};

export default ConnectionPopup;