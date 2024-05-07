import React from 'react';
import ConnectionSettingsForm from './forms/ConnectionSettingsForm';

interface ConnectionPopupTypes {
  open: boolean;
  closePopup: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionPopup: React.FC<ConnectionPopupTypes> = ({ open, closePopup }) => {
  return (
    <div className={["popup-container", ...(open ? ["popup-opened"] : [])].join(" ")}>
        <div className="popup-overlay" onClick={closePopup}></div>
        <div className="popup-content connection-settings-popup">
          <ConnectionSettingsForm closePopup={closePopup} />
        </div>
      </div>
  );
};

export default ConnectionPopup;