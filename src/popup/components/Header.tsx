import React from 'react';
import cx from 'classnames';
import styles from "./Header.module.css";
import { getContextBreadcrumbs } from '../utils';

interface HeaderTypes {
  url: string;
}

const Header: React.FC<HeaderTypes> = ({ url }) => {
  return (
    <header className="navbar-fixed">
      <nav className="nav-extended white">
        <div className="nav-wrapper">
          <a href="#" className="brand-logo right black-text">
            <img src="icons/logo_256x256.png" className="brand-logo right" width="40px" style={{ marginTop: "8px" }} />
          </a>
          <div id="breadcrumb-container" className="col s12 black-text">{getContextBreadcrumbs(url).map(bread => (<a {...bread}>{bread.textContent}</a>))}</div>
        </div>
        <div className="nav-content">
          {/* <ul className="tabs black-text">
            <li className="tab"><a href="#browser-to-canvas">Browser to Canvas</a></li>
            <li className="tab"><a href="#canvas-to-browser">Canvas to Browser</a></li>
            <li className="tab"><a href="#tab-search"><i className="material-icons">search</i></a></li>
            <li className="tab"><a href="#settings"><i className="material-icons">settings</i></a></li>
          </ul> */}
        </div>
      </nav>
    </header>
  );
};

export default Header;