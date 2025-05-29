import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { isOnUniverse } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import CanvasTabsCollection from '../CanvasTabsCollection';
import { browser } from '@/general/utils';
import { useContext } from '../../hooks/useStorage';
import styles from './CanvasToBrowser.module.scss';

const CanvasToBrowser: React.FC<any> = ({ }) => {
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const [checkedCanvasTabs, setCheckedCanvasTabs] = useState<ICanvasTab[]>([]);
  const [checkedOpenedCanvasTabs, setCheckedOpenedCanvasTabs] = useState<ICanvasTab[]>([]);

  const [context] = useContext();
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    closedCanvas: true,
    openedCanvas: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const openAllClicked = () => {
    console.log('UI | Opening all tabs from canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser }).catch((error) => {
      console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  const openSelectedClicked = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, openableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, tabs: openableTabs }).catch((error) => {
      console.error('UI | Error opening tabs from canvas:', error);
    });
    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  const removeSelectedClicked = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, removableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tabs_remove, tabs: removableTabs }).catch((error) => {
      console.error('UI | Error deleting tabs from canvas:', error);
    });

    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  const deleteSelectedClicked = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, deletableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_delete, tabs: deletableTabs }).catch((error) => {
      console.error('UI | Error deleting tabs from canvas:', error);
    });
    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  return (
    <div className={styles.tabCollectionContainer}>
      <div className={styles.header}>
        <h5 className={styles.title}>Open from Canvas</h5>
        <div className={styles.buttonContainer}>
          <button
            className={styles.btn}
            onClick={openAllClicked}
          >
            <span>Open All</span>
            <span className={styles.icon}>↗</span>
          </button>

          {checkedCanvasTabs.length > 0 && (
            <button
              className={styles.btn}
              onClick={(e) => openSelectedClicked(e, checkedCanvasTabs)}
            >
              <span>Open Selected</span>
              <span className={styles.icon}>↗</span>
            </button>
          )}

          {!isOnUniverse(context) && (checkedCanvasTabs.length > 0 || checkedOpenedCanvasTabs.length > 0) && (
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={(e) => removeSelectedClicked(e, [...checkedCanvasTabs, ...checkedOpenedCanvasTabs])}
            >
              <span>Remove Selected</span>
              <span className={styles.icon}>−</span>
            </button>
          )}

          {(checkedCanvasTabs.length > 0 || checkedOpenedCanvasTabs.length > 0) && (
            <button
              className={`${styles.btn} ${styles.btnDestructive}`}
              onClick={(e) => deleteSelectedClicked(e, [...checkedCanvasTabs, ...checkedOpenedCanvasTabs])}
            >
              <span>Delete Selected</span>
              <span className={styles.icon}>✕</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles.collapsibleContainer}>
        <div className={styles.collapsibleItem}>
          <div
            className={styles.collapsibleHeader}
            onClick={() => toggleSection('closedCanvas')}
          >
            <span className={styles.expandIcon}>
              {expandedSections.closedCanvas ? '▼' : '▶'}
            </span>
            <span className={styles.sectionIcon}>📄</span>
            <span className={styles.sectionTitle}>
              Closed Canvas Tabs ({tabs.canvasTabs.length})
            </span>
          </div>
          {expandedSections.closedCanvas && (
            <div className={styles.collapsibleContent}>
              <CanvasTabsCollection
                checkedTabs={checkedCanvasTabs}
                setCheckedTabs={setCheckedCanvasTabs}
                canvasTabs={tabs.canvasTabs}
              />
            </div>
          )}
        </div>

        <div className={styles.collapsibleItem}>
          <div
            className={styles.collapsibleHeader}
            onClick={() => toggleSection('openedCanvas')}
          >
            <span className={styles.expandIcon}>
              {expandedSections.openedCanvas ? '▼' : '▶'}
            </span>
            <span className={styles.sectionIcon}>☁</span>
            <span className={styles.sectionTitle}>
              Opened Canvas Tabs ({tabs.openedCanvasTabs.length})
            </span>
          </div>
          {expandedSections.openedCanvas && (
            <div className={styles.collapsibleContent}>
              <CanvasTabsCollection
                checkedTabs={checkedOpenedCanvasTabs}
                setCheckedTabs={setCheckedOpenedCanvasTabs}
                canvasTabs={tabs.openedCanvasTabs}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanvasToBrowser;
