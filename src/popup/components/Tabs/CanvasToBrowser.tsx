import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { isOnUniverse } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import CanvasTabsCollection from '../CanvasTabsCollection';
import { Collapsible, CollapsibleItem, Icon } from 'react-materialize';
import { browser } from '@/general/utils';

const CanvasToBrowser: React.FC<any> = ({ }) => {
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const [checkedCanvasTabs, setCheckedCanvasTabs] = useState<ICanvasTab[]>([]);
  const [checkedOpenedCanvasTabs, setCheckedOpenedCanvasTabs] = useState<ICanvasTab[]>([]);
  const variables = useSelector((state: { variables: IVarState }) => state.variables);

  const openAllClicked = () => {
    console.log('UI | Opening all tabs from canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser }).catch((error) => {
      console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  const openSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, openableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, tabs: openableTabs }).catch((error) => {
      console.error('UI | Error opening tabs from canvas:', error);
    });
    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  const removeSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, removableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tabs_remove, tabs: removableTabs }).catch((error) => {
      console.error('UI | Error deleting tabs from canvas:', error);
    });

    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  const deleteSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, deletableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_delete, tabs: deletableTabs }).catch((error) => {
      console.error('UI | Error deleting tabs from canvas:', error);
    });
    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  return (
    <div className="tab-collection-container">
      <h5>Open all tabs
        (<span className="" id="canvas-tab-delta-count">{tabs.canvasTabs?.length}</span>)
      </h5>
      <div className="button-container">
        <a className="black white-text waves-effect waves-light btn-small right" onClick={openAllClicked}>Open all<i className="material-icons right">sync</i></a>
        {checkedCanvasTabs.length ? (
          <a className="black white-text waves-effect waves-light btn-small right"
            onClick={(e) => openSelectedClicked(e, checkedCanvasTabs)}>Open selected<i className="material-icons right">sync</i></a>
        ) : null}

        {!isOnUniverse(variables.context.url) && (checkedCanvasTabs.length || checkedOpenedCanvasTabs.length) ? (
          <a className="black white-text waves-effect waves-light btn-small right"
            onClick={(e) => removeSelectedClicked(e, [...checkedCanvasTabs, ...checkedOpenedCanvasTabs])}>Remove Selected<i className="material-icons right">delete</i></a>
        ) : null}

        {checkedCanvasTabs.length || checkedOpenedCanvasTabs.length ? (
          <a className="black white-text waves-effect waves-light btn-small right"
            onClick={(e) => deleteSelectedClicked(e, [...checkedCanvasTabs, ...checkedOpenedCanvasTabs])}>Delete Selected<i className="material-icons right">delete</i></a>
        ) : null}
      </div>

      <Collapsible accordion={false}>
        <CollapsibleItem
          expanded={true}
          header="Closed Canvas Tabs"
          icon={<Icon>sync</Icon>}
          node="div"
        >
          <CanvasTabsCollection
            checkedTabs={checkedCanvasTabs}
            setCheckedTabs={setCheckedCanvasTabs}
            canvasTabs={tabs.canvasTabs} />
        </CollapsibleItem>

        <CollapsibleItem
          expanded={false}
          header="Opened Canvas Tabs"
          icon={<Icon>cloud_sync</Icon>}
          node="div"
        >
          <CanvasTabsCollection
            checkedTabs={checkedOpenedCanvasTabs}
            setCheckedTabs={setCheckedOpenedCanvasTabs}
            canvasTabs={tabs.openedCanvasTabs} />
        </CollapsibleItem>
      </Collapsible>
    </div>
  );
};

export default CanvasToBrowser;