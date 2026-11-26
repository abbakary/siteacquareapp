import { useCallback, useEffect, useState } from 'react';

export type DevicePlatform = 'android' | 'ios' | 'desktop';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function detectPlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const maxTouch = navigator.maxTouchPoints || 0;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

function detectDeviceType(width: number): DeviceType {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as NavigatorWithStandalone;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  );
}

export interface DeviceAndPwaState {
  platform: DevicePlatform;
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useDeviceAndPWA(): DeviceAndPwaState {
  const [platform] = useState<DevicePlatform>(detectPlatform);
  const [deviceType, setDeviceType] = useState<DeviceType>(() =>
    typeof window !== 'undefined' ? detectDeviceType(window.innerWidth) : 'desktop'
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(checkIsStandalone);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onResize = () => {
      setDeviceType(detectDeviceType(window.innerWidth));
    };
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    const standaloneMq = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setIsInstalled(checkIsStandalone());

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    standaloneMq?.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      standaloneMq?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    platform,
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isOnline,
    install,
  };
}
