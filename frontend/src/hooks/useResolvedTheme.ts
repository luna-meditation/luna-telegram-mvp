import {useSyncExternalStore} from 'react';
import {readThemePreference,resolveThemePreference} from './useTheme';
const snapshot=()=>resolveThemePreference(readThemePreference());
function subscribe(listener:()=>void){const observer=new MutationObserver(listener);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();}
export function useResolvedTheme(){return useSyncExternalStore(subscribe,snapshot,()=> 'dark' as const);}
