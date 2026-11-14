import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ThemePalette } from '../themes/themes';
import { Track } from '../types/audio';

interface SonanceWidgetPlugin {
  notifyUpdate(): Promise<void>;
}

const SonanceWidget = registerPlugin<SonanceWidgetPlugin>('SonanceWidget');

export interface WidgetSyncPayload {
  track: Track | null;
  isPlaying: boolean;
  theme: ThemePalette;
}

export async function syncWidgetState({
  track,
  isPlaying,
  theme,
}: WidgetSyncPayload): Promise<void> {
  const title = track?.title ?? 'Sonance';
  const artist = track ? `${track.artist} · ${track.format}` : 'Tap to play music';
  const album = track?.album ?? 'Offline Library';

  try {
    await Promise.all([
      Preferences.set({ key: 'sonance_widget_title', value: title }),
      Preferences.set({ key: 'sonance_widget_artist', value: artist }),
      Preferences.set({ key: 'sonance_widget_album', value: album }),
      Preferences.set({ key: 'sonance_widget_playing', value: isPlaying ? 'true' : 'false' }),
      Preferences.set({ key: 'sonance_widget_accent', value: theme.accent }),
      Preferences.set({ key: 'sonance_widget_bg', value: theme.surface }),
      Preferences.set({ key: 'sonance_widget_text', value: theme.textPrimary }),
      Preferences.set({ key: 'sonance_widget_muted', value: theme.textMuted }),
    ]);

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        await SonanceWidget.notifyUpdate();
      } catch {
        // Native bridge plugin is optional if AppWidget polls/receives Preferences updates
      }
    }
  } catch (err) {
    console.warn('Widget state sync skipped:', err);
  }
}

export type WidgetTransportAction = 'play_pause' | 'next' | 'prev';

export function subscribeWidgetTransportActions(
  onAction: (action: WidgetTransportAction) => void
): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ action?: WidgetTransportAction }>;
    if (customEvent.detail?.action) {
      onAction(customEvent.detail.action);
    }
  };

  window.addEventListener('sonance-widget-action', handler);
  return () => window.removeEventListener('sonance-widget-action', handler);
}
