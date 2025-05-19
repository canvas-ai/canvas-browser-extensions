import '@/assets/base.scss'
import { render } from 'react-dom';
import React from 'react';
import App from './App';
import store from './redux/store';
import { Provider } from 'react-redux';
import initializeConfig from '@/initConfig';
import configStore from '@/general/ConfigStore';

// Handle configuration initialization errors properly
const startApp = async () => {
  try {
    // Initialize configuration
    await initializeConfig();
    console.log('Popup: Configuration initialized successfully');

    // Render the app
    render(
      <Provider store={store}>
        <App />
      </Provider>,
      document.getElementById('root')
    );
  } catch (error) {
    console.error('Popup: Failed to initialize configuration:', error);

    // Render error UI if initialization fails
    const errorEl = document.createElement('div');
    errorEl.style.padding = '20px';
    errorEl.style.color = 'red';
    errorEl.innerHTML = `
      <h3>Configuration Error</h3>
      <p>Failed to initialize configuration. Try reloading the extension.</p>
      <button id="retry">Retry</button>
    `;

    document.getElementById('root')?.appendChild(errorEl);

    // Add retry button handler
    document.getElementById('retry')?.addEventListener('click', () => {
      location.reload();
    });
  }
};

// Start the app
startApp();
