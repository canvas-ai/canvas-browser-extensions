import React, { useMemo, useState, useEffect } from 'react';
import { getContextBreadcrumbsFromContext } from '../utils';
import { useSelectedContext, useContextList } from '../hooks/useStorage';

const Header: React.FC = () => {
  const [selectedContext] = useSelectedContext();
  const [contextList] = useContextList();
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{href: string, className: string, textContent: string}>>([]);

  useEffect(() => {
    const updateBreadcrumbs = async () => {
      const contextToUse = selectedContext || (contextList && contextList.length > 0 ? contextList[0] : null);

      if (!contextToUse) {
        console.log('Header: No context available for breadcrumbs');
        setBreadcrumbs([{
          href: "#!",
          className: "breadcrumb black-text",
          textContent: "(default) universe:///"
        }]);
        return;
      }

      console.log('Header: Using context for breadcrumbs:', contextToUse.id, contextToUse.url);

      const newBreadcrumbs = await getContextBreadcrumbsFromContext(contextToUse);
      setBreadcrumbs(newBreadcrumbs);
    };

    updateBreadcrumbs();
  }, [selectedContext, contextList]);

  return (
    <header className="navbar-fixed">
      <nav className="nav-extended white">
        <div className="nav-wrapper">
          <a href="#" className="brand-logo right black-text">
            <img src="icons/logo_256x256.png" className="brand-logo right" width="40px" style={{ marginTop: "8px" }} />
          </a>
          <div id="breadcrumb-container" className="col s12 black-text">
            {breadcrumbs.map((bread, index) => (
              <span key={index}>
                <a {...bread}>{bread.textContent}</a>
                {index < breadcrumbs.length - 1 && <span className="breadcrumb-separator"> &gt; </span>}
              </span>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
