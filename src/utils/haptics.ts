import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let lastSelectionTickAt = 0;

function isNativeHapticsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Fires a crisp native light haptic impact on Capacitor Android/iOS devices.
 * Silently no-ops on desktop/unsupported browsers without throwing.
 */
export async function triggerHapticLight(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch {
    // Ignore when haptics plugin is unavailable in webview/browser
  }
}

export async function triggerHapticMedium(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticHeavy(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticSuccess(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.notification({ type: NotificationType.Success });
    }
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticWarning(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticError(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.notification({ type: NotificationType.Error });
    }
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticSelectionStart(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      lastSelectionTickAt = performance.now();
      await Haptics.selectionStart();
    }
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticSelectionChanged(minIntervalMs = 45): Promise<void> {
  try {
    if (!isNativeHapticsAvailable()) return;
    const now = performance.now();
    if (now - lastSelectionTickAt < minIntervalMs) return;
    lastSelectionTickAt = now;
    await Haptics.selectionChanged();
  } catch {
    // Ignore on unsupported platforms
  }
}

export async function triggerHapticSelectionEnd(): Promise<void> {
  try {
    if (isNativeHapticsAvailable()) {
      await Haptics.selectionEnd();
    }
  } catch {
    // Ignore on unsupported platforms
  }
}
