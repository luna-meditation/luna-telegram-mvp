import {useEffect} from 'react';
// Legacy values remain type-compatible but can no longer activate Light/System.
export type ThemePreference='system'|'light'|'dark';
export type ResolvedTheme='light'|'dark';
export const THEME_STORAGE_KEY='luna.theme.preference.v1';
export const DEFAULT_THEME_PREFERENCE:ThemePreference='dark';
export function readThemePreference():ThemePreference{return 'dark';}
export function resolveThemePreference(preference:ThemePreference,systemDark?:boolean):ResolvedTheme{void preference;void systemDark;return 'dark';}
export function useThemePreference(){
 useEffect(()=>{
  try{window.localStorage.setItem(THEME_STORAGE_KEY,'dark');}catch{/* Session remains dark. */}
  const root=document.documentElement;root.dataset.theme='dark';root.dataset.themePreference='dark';root.style.colorScheme='dark';root.dataset.themeReady='true';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#030612');
 },[]);
 return {themePreference:'dark' as ThemePreference,resolvedTheme:'dark' as ResolvedTheme,setThemePreference:(preference:ThemePreference)=>{void preference;}};
}
