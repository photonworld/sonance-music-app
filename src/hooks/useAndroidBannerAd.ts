import { useEffect, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize,
} from '@capacitor-community/admob';

export const ANDROID_PRODUCTION_BANNER_AD_ID = 'ca-app-pub-6695800707357090/3173650097';

export function useAndroidBannerAd() {
  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  // Reserve adaptive banner clearance on Android while the ad initializes,
  // then adjust to the exact reported height (or 0 if load fails).
  const [bannerHeight, setBannerHeight] = useState<number>(isAndroidNative ? 60 : 0);

  useEffect(() => {
    if (!isAndroidNative) return;

    let cancelled = false;
    const handles: PluginListenerHandle[] = [];

    async function initAndShowBanner() {
      try {
        await AdMob.initialize({
          initializeForTesting: false,
        });

        if (cancelled) return;

        const sizeHandle = await AdMob.addListener(
          BannerAdPluginEvents.SizeChanged,
          (info: AdMobBannerSize) => {
            if (!cancelled) {
              setBannerHeight(Math.max(0, info.height));
            }
          }
        );
        handles.push(sizeHandle);

        const loadedHandle = await AdMob.addListener(
          BannerAdPluginEvents.Loaded,
          () => {
            if (!cancelled) {
              setBannerHeight((prev) => (prev > 0 ? prev : 50));
            }
          }
        );
        handles.push(loadedHandle);

        const failedHandle = await AdMob.addListener(
          BannerAdPluginEvents.FailedToLoad,
          () => {
            if (!cancelled) {
              setBannerHeight(0);
            }
          }
        );
        handles.push(failedHandle);

        await AdMob.showBanner({
          adId: ANDROID_PRODUCTION_BANNER_AD_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: false,
        });
      } catch (err) {
        console.error('Failed to initialize Android AdMob banner:', err);
        if (!cancelled) {
          setBannerHeight(0);
        }
      }
    }

    void initAndShowBanner();

    return () => {
      cancelled = true;
      for (const handle of handles) {
        void handle.remove();
      }
      void AdMob.removeBanner().catch(() => {});
    };
  }, [isAndroidNative]);

  return { bannerHeight, isAndroidNative };
}
