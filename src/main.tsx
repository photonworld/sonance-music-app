import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installStandaloneApiInterceptor } from './utils/standaloneApi';
import App from './App.tsx';
import './index.css';

installStandaloneApiInterceptor();

if (!localStorage.getItem('sonance-perm-v2')) {
  localStorage.removeItem('sonance-initial-scan-done');
  localStorage.setItem('sonance-perm-v2', '1');
}

// Sync active playback metadata & controls with Android Notification Media Player
function setupNotificationMediaBridge() {
  let lastTitle = '';
  let lastArtist = '';
  let lastPlaying: boolean | null = null;
  let lastArtwork = '';

  const pushStateToAndroid = () => {
    const bridge = (window as unknown as {
      SonanceMediaBridge?: {
        updateNotification: (title: string, artist: string, isPlaying: boolean, artwork: string) => void;
      };
    }).SonanceMediaBridge;
    if (!bridge) return;

    const audioEl = document.querySelector('audio');
    const isPlaying = audioEl ? !audioEl.paused && !audioEl.ended : false;

    const meta = navigator.mediaSession?.metadata;
    const title = meta?.title || document.title.replace(/\s*·\s*Sonance.*$/i, '').trim() || 'Sonance';
    const artist = meta?.artist || 'Sonance Audio';
    const artSrc = meta?.artwork?.[0]?.src || '';

    if (
      title === lastTitle &&
      artist === lastArtist &&
      isPlaying === lastPlaying &&
      artSrc === lastArtwork
    ) {
      return;
    }

    lastTitle = title;
    lastArtist = artist;
    lastPlaying = isPlaying;
    lastArtwork = artSrc;

    try {
      bridge.updateNotification(title, artist, isPlaying, artSrc.startsWith('data:') ? artSrc : '');
    } catch {
      // ignore if activity is backgrounded
    }
  };

  window.setInterval(pushStateToAndroid, 1000);
  document.addEventListener('play', pushStateToAndroid, true);
  document.addEventListener('pause', pushStateToAndroid, true);

  // Handle Previous / Play-Pause / Next taps from Android Notification shade
  window.addEventListener('sonance-notif-action', (ev: Event) => {
    const action = (ev as CustomEvent<string>).detail;
    const findBtn = (labels: string[]) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((b) => {
        const label = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
        return labels.some((l) => label.includes(l));
      });
    };

    if (action === 'play_pause') {
      const btn = findBtn(['pause', 'play']);
      if (btn) {
        btn.click();
      } else {
        const audio = document.querySelector('audio');
        if (audio) {
          if (audio.paused) void audio.play();
          else audio.pause();
        }
      }
    } else if (action === 'next') {
      findBtn(['next'])?.click();
    } else if (action === 'prev') {
      findBtn(['previous', 'prev'])?.click();
    }
    window.setTimeout(pushStateToAndroid, 250);
  });
}

setupNotificationMediaBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
