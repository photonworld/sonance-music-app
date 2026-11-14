import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { installStandaloneApiInterceptor } from './utils/standaloneApi';
import App from './App.tsx';
import './index.css';

installStandaloneApiInterceptor();

if (Capacitor.isNativePlatform()) {
  Filesystem.requestPermissions().catch(() => {});
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
