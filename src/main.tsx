import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installStandaloneApiInterceptor } from './utils/standaloneApi';
import App from './App.tsx';
import './index.css';

installStandaloneApiInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
