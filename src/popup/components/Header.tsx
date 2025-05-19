import React, { useEffect, useState, useRef } from 'react';
import { getContextBreadcrumbs } from '../utils';
import { useSelector } from 'react-redux';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from '@/general/constants';
// import { browser } from '@/general/utils'; // No longer needed
// import { RUNTIME_MESSAGES } from '@/general/constants'; // No longer needed

interface HeaderTypes {
  url: string | undefined;
}

const Header: React.FC<HeaderTypes> = ({ url }) => {
  // Track current URL in local state as well for rendering stability
  const [currentUrl, setCurrentUrl] = useState<string>(url || '');

  // Also listen directly to context changes from Redux
  const contextFromRedux = useSelector((state: { variables: IVarState }) => state.variables.context);

  // Reference to track last update time to prevent duplicate updates
  const lastUpdateTimeRef = useRef<number>(0);

  // Update local state when url prop changes
  useEffect(() => {
    if (url && url !== currentUrl) {
      console.log(`Header: URL prop changed from "${currentUrl}" to "${url}"`);
      setCurrentUrl(url);
      lastUpdateTimeRef.current = Date.now();
    }
  }, [url, currentUrl]);

  // Also update local state directly from Redux for double reliability
  useEffect(() => {
    if (contextFromRedux?.url && contextFromRedux.url !== currentUrl) {
      console.log(`Header: Context URL from Redux changed to "${contextFromRedux.url}"`);
      setCurrentUrl(contextFromRedux.url);
      lastUpdateTimeRef.current = Date.now();
    }
  }, [contextFromRedux, currentUrl]);

  // Set up direct socket event listener for maximum reliability
  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      // Only process socket events
      if (message.type !== RUNTIME_MESSAGES.socket_event) {
        return;
      }

      const payload = message.payload;

      // Only care about CONTEXT_URL_CHANGED events
      if (payload?.event !== SOCKET_EVENTS.CONTEXT_URL_CHANGED) {
        return;
      }

      console.log('Header: Received CONTEXT_URL_CHANGED socket event:', payload);

      // Check if we have a valid URL in the payload
      if (payload.url && typeof payload.url === 'string') {
        // Avoid duplicate updates with throttling
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < 1000) {
          console.log('Header: Ignoring duplicate URL update, too soon after last update');
          return;
        }

        console.log(`Header: Directly updating URL from socket event to "${payload.url}"`);
        setCurrentUrl(payload.url);
        lastUpdateTimeRef.current = now;

        // Force a full context refresh to ensure Redux state is up to date
        browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_get })
          .catch(err => console.error('Error requesting context update:', err));
      }
    };

    // Add the direct listener
    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    // Manual initial context request to ensure we have the latest
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_get })
      .catch(err => console.error('Error requesting initial context:', err));

    return () => {
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  // Log final rendered URL for debugging
  console.log(`Header rendering with URL: "${currentUrl || 'none'}"`);

  // Removed handleInputChange, handleSubmit, handleKeyDown

  return (
    <header className="navbar-fixed">
      <nav className="nav-extended white">
        <div className="nav-wrapper">
          <div id="breadcrumb-container" className="col s12 black-text">
            {currentUrl && getContextBreadcrumbs(currentUrl).map((bread, index) => (
              <a key={index} {...bread}>
                {bread.textContent}
              </a>
            ))}
          </div>
          <a href="#" className="brand-logo right black-text">
            <img src="icons/logo_256x256.png" className="brand-logo right" width="40px" style={{ marginTop: "8px" }} alt="Canvas logo" />
          </a>
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
