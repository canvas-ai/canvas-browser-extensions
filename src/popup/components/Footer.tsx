import React from 'react';
import styles from "./Footer.module.scss";
import { cx } from '../utils';

const Footer: React.FC<any> = () => {
  return (
    <footer className={cx(styles.footer, "page-footer grey darken-3")}>
      <div className="white-text">
        <div className={styles.footerContent + " row"}>
          <div className="col s6 16 left-align">©2024 Canvas UI</div>
          <div className="col s6 16 right-align">
            <a className="white-text text-lighten-4" href="https://github.com/idncsk/canvas-ui-browser/issues/new" target="_blank">Submit an issue</a>
          </div>
        </div>
      </div>
    </footer>

  );
};

export default Footer;