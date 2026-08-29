import { useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'luna.theme.preference.v1';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME_PREFERENCE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function resolveThemePreference(preference: ThemePreference, systemDark?: boolean): ResolvedTheme {
  if (preference !== 'system') return preference;
  const prefersDark = systemDark ?? (typeof window !== 'undefined' && window.matchMedia(DARK_MEDIA_QUERY).matches);
  return prefersDark ? 'dark' : 'light';
}

function applyTheme(preference: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#030612' : '#f8f5f1');
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && window.matchMedia(DARK_MEDIA_QUERY).matches);
  const resolvedTheme = useMemo(() => resolveThemePreference(preference, systemDark), [preference, systemDark]);

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => setSystemDark(event.matches);
    updateSystemTheme(media);
    if (media.addEventListener) {
      media.addEventListener('change', updateSystemTheme);
      return () => media.removeEventListener('change', updateSystemTheme);
    }
    media.addListener(updateSystemTheme);
    return () => media.removeListener(updateSystemTheme);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Theme remains active for this session when storage is unavailable.
    }
    applyTheme(preference, resolvedTheme);
    const frame = window.requestAnimationFrame(() => {
      document.documentElement.dataset.themeReady = 'true';
    });
    return () => window.cancelAnimationFrame(frame);
  }, [preference, resolvedTheme]);

  return { themePreference: preference, resolvedTheme, setThemePreference: setPreference };
}
