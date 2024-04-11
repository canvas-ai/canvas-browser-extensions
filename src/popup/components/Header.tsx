import React from 'react';
import styles from "./Header.module.css";
import { getContextBreadcrumbs } from '../utils';

interface HeaderTypes {
  url: string | undefined;
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
        {/* <div className="nav-content">
        </div> */}
      </nav>
    </header>
  );
};

export default Header;