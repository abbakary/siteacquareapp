import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';

export type ThemeMode = 'system' | 'light' | 'dark';

interface UiPreferences {
  themeMode: ThemeMode;
  reduceAnimations: boolean;
}

interface PreferencesContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  reduceAnimations: boolean;
  effectiveReducedMotion: boolean;
  lowEndDeviceDetected: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  setReduceAnimations: (reduce: boolean) => void;
  triggerHaptic: (durationMs?: number) => void;
}

const PREFS_STORAGE_KEY = 'dukaaqusmart_ui_prefs_v1';

function detectLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
}

function loadInitialPrefs(): UiPreferences {
  const lowEnd = detectLowEndDevice();
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiPreferences>;
      return {
        themeMode:
          parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'system'
            ? parsed.themeMode
            : 'light',
        reduceAnimations:
          typeof parsed.reduceAnimations === 'boolean' ? parsed.reduceAnimations : lowEnd,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    themeMode: 'light',
    reduceAnimations: lowEnd,
  };
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<UiPreferences>(loadInitialPrefs);
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const osReducedMotion = useReducedMotion() ?? false;
  const lowEndDeviceDetected = useMemo(() => detectLowEndDevice(), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const isDark =
    prefs.themeMode === 'dark' || (prefs.themeMode === 'system' && systemDark);
  const effectiveReducedMotion = Boolean(prefs.reduceAnimations || osReducedMotion);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore quota errors
    }
  }, [prefs]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('reduce-motion', effectiveReducedMotion);
  }, [isDark, effectiveReducedMotion]);

  const setThemeMode = (themeMode: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, themeMode }));
  };

  const cycleThemeMode = () => {
    setPrefs((prev) => {
      const order: ThemeMode[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(prev.themeMode) + 1) % order.length];
      return { ...prev, themeMode: next };
    });
  };

  const setReduceAnimations = (reduceAnimations: boolean) => {
    setPrefs((prev) => ({ ...prev, reduceAnimations }));
  };

  const triggerHaptic = (durationMs = 10) => {
    if (effectiveReducedMotion) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(durationMs);
      }
    } catch {
      // ignore unsupported vibration errors
    }
  };

  const value: PreferencesContextValue = {
    themeMode: prefs.themeMode,
    isDark,
    reduceAnimations: prefs.reduceAnimations,
    effectiveReducedMotion,
    lowEndDeviceDetected,
    setThemeMode,
    cycleThemeMode,
    setReduceAnimations,
    triggerHaptic,
  };

  return (
    <PreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={effectiveReducedMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </PreferencesContext.Provider>
  );
};

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    return {
      themeMode: 'light',
      isDark: false,
      reduceAnimations: false,
      effectiveReducedMotion: false,
      lowEndDeviceDetected: false,
      setThemeMode: () => {},
      cycleThemeMode: () => {},
      setReduceAnimations: () => {},
      triggerHaptic: () => {},
    };
  }
  return ctx;
}
