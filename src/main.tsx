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

// Generate an animated-feeling aurora gradient artwork with live waveform bars for the Android Notification card
function renderDynamicNotifArtwork(title: string, isPlaying: boolean, tick: number): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash * 31 + title.charCodeAt(i)) | 0;
    }
    const hue1 = Math.abs(hash) % 360;
    const hue2 = (hue1 + 65) % 360;

    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, `hsl(${hue1}, 78%, 28%)`);
    grad.addColorStop(0.5, `hsl(${(hue1 + 32) % 360}, 72%, 18%)`);
    grad.addColorStop(1, `hsl(${hue2}, 82%, 34%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle glowing orb
    const orbX = 128 + Math.sin(tick * 0.6) * 34;
    const orbY = 110 + Math.cos(tick * 0.5) * 24;
    const orb = ctx.createRadialGradient(orbX, orbY, 10, orbX, orbY, 120);
    orb.addColorStop(0, `hsla(${hue2}, 95%, 65%, 0.45)`);
    orb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, 256, 256);

    // Smooth equalizer wave bars
    const barCount = 9;
    const barWidth = 12;
    const gap = 8;
    const totalW = barCount * barWidth + (barCount - 1) * gap;
    const startX = (256 - totalW) / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    for (let i = 0; i < barCount; i++) {
      const wave = isPlaying
        ? 0.35 + 0.65 * Math.abs(Math.sin(tick * 0.9 + i * 0.7))
        : 0.25 + (i % 3) * 0.1;
      const barH = Math.max(18, Math.round(wave * 84));
      const x = startX + i * (barWidth + gap);
      const y = 128 - barH / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 6);
      ctx.fill();
    }

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return '';
  }
}

function setupNotificationMediaBridge() {
  let animTick = 0;
  let lastArtKey = '';
  let cachedArtDataUrl = '';

  const getActiveAudio = (): HTMLAudioElement | null => {
    const audios = Array.from(document.querySelectorAll('audio'));
    return audios.find((a) => !a.paused && a.src) || audios.find((a) => Boolean(a.src)) || audios[0] || null;
  };

  const pushStateToAndroid = () => {
    const bridge = (window as unknown as {
      SonanceMediaBridge?: {
        updateNotification: (
          title: string,
          artist: string,
          isPlaying: boolean,
          positionMs: number,
          durationMs: number,
          artwork: string
        ) => void;
      };
    }).SonanceMediaBridge;
    if (!bridge) return;

    const audioEl = getActiveAudio();
    const isPlaying = audioEl ? !audioEl.paused && !audioEl.ended : false;
    const positionMs = audioEl && Number.isFinite(audioEl.currentTime) ? Math.round(audioEl.currentTime * 1000) : 0;
    const durationMs =
      audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0
        ? Math.round(audioEl.duration * 1000)
        : 0;

    const meta = navigator.mediaSession?.metadata;
    const title =
      meta?.title ||
      document.title.replace(/\s*·\s*Sonance.*$/i, '').trim() ||
      'Sonance';
    const artist = meta?.artist || 'Sonance Audio';
    const metaArt = meta?.artwork?.[0]?.src || '';

    if (isPlaying) animTick += 1;
    const artKey = `${title}|${isPlaying ? animTick % 8 : 'paused'}`;
    if (metaArt.startsWith('data:image')) {
      cachedArtDataUrl = metaArt;
    } else if (artKey !== lastArtKey) {
      lastArtKey = artKey;
      cachedArtDataUrl = renderDynamicNotifArtwork(title, isPlaying, animTick);
    }

    try {
      bridge.updateNotification(title, artist, isPlaying, positionMs, durationMs, cachedArtDataUrl);
    } catch {
      // ignore if activity is backgrounded
    }
  };

  window.setInterval(pushStateToAndroid, 1000);
  document.addEventListener('play', pushStateToAndroid, true);
  document.addEventListener('pause', pushStateToAndroid, true);
  document.addEventListener('loadedmetadata', pushStateToAndroid, true);

  // Handle Play/Pause, Next, Previous, and Trackbar Seek directly from Android Notification
  window.addEventListener('sonance-notif-action', (ev: Event) => {
    const detail = (ev as CustomEvent<{ action: string; value?: number }>).detail;
    const action = typeof detail === 'string' ? detail : detail?.action;
    const value = typeof detail === 'object' ? detail?.value ?? 0 : 0;

    const audio = getActiveAudio();

    if (action === 'play_pause') {
      if (audio && audio.src) {
        if (audio.paused) {
          void audio.play();
        } else {
          audio.pause();
        }
      } else {
        const dockBtn = Array.from(document.querySelectorAll('footer button, [class*="dock"] button, button')).find((b) => {
          const lbl = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
          return lbl === 'play' || lbl === 'pause' || lbl.includes('play/pause');
        });
        dockBtn?.click();
      }
    } else if (action === 'seek') {
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, value / 1000));
      }
    } else if (action === 'next') {
      const nextBtn = Array.from(document.querySelectorAll('button')).find((b) => {
        const lbl = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
        return lbl.includes('next');
      });
      nextBtn?.click();
    } else if (action === 'prev') {
      const prevBtn = Array.from(document.querySelectorAll('button')).find((b) => {
        const lbl = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
        return lbl.includes('previous') || lbl.includes('prev');
      });
      prevBtn?.click();
    }

    window.setTimeout(pushStateToAndroid, 150);
  });
}

setupNotificationMediaBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
