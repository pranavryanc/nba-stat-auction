import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const isE2ETestMode = import.meta.env.VITE_E2E_TEST_MODE === 'true';

if (sentryDsn && !isE2ETestMode) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-gray-600">
              An unexpected error occurred. Please refresh the page and try again.
            </p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-black px-4 py-2 font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </main>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
