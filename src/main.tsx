import './i18n/config';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { installVitePreloadErrorHandler } from '@/lib/chunkReload';
import App from './App.tsx';
import './index.css';

// Antes de montar React: si un chunk hasheado ya no existe tras un deploy, recargar una vez.
installVitePreloadErrorHandler();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
