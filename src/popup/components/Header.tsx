import React, { useEffect } from 'react';
import { getContextBreadcrumbs } from '../utils';

interface HeaderTypes {
  url: string | undefined;
}

const Header: React.FC<HeaderTypes> = ({ url }) => {
  useEffect(() => {
    console.log("Header: URL changed to:", url);
  }, [url]);

  // Log url to easily debug why Header isn't updating
  console.log("Header rendering with URL:", url);

  return (
    <header className="navbar-fixed">
      <nav className="nav-extended white">
        <div className="nav-wrapper">
          <a href="#" className="brand-logo right black-text">
            <img src="icons/logo_256x256.png" className="brand-logo right" width="40px" style={{ marginTop: "8px" }} alt="Canvas logo" />
          </a>
          <div id="breadcrumb-container" className="col s12 black-text">
            {url && getContextBreadcrumbs(url).map((bread, index) => (
              <a key={index} {...bread}>
                {bread.textContent}
              </a>
            ))}
          </div>
        </div>
        {/* <div className="nav-content">
        </div> */}
      </nav>
    </header>
  );
};

// Custom memo comparator to ensure we rerender when URL changes
const areEqual = (prevProps: HeaderTypes, nextProps: HeaderTypes) => {
  // Only consider equal (and skip rerender) if URLs are identical
  return prevProps.url === nextProps.url;
};

// Memoize the component with our custom comparator
export default React.memo(Header, areEqual);
