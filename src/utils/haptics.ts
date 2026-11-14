import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Fires a crisp native light haptic impact on Capacitor Android/iOS devices.
 * Silently no-ops on desktop/unsupported browsers without throwing.
 */
export async function triggerHapticLight(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch {
    // Ignore when haptics plugin is unavailable in webview/browser
  }
}

export async function triggerHapticMedium(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    }
  } catch {
    // Ignore on unsupported platforms
  }
}
