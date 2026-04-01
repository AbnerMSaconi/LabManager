import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider as OidcAuthProvider } from 'react-oidc-context';
import App from './App.tsx';
import './index.css';
import { oidcConfig } from './oidcConfig';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OidcAuthProvider {...oidcConfig}>
      <App />
    </OidcAuthProvider>
  </StrictMode>,
);
