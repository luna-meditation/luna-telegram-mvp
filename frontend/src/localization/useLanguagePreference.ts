import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {getLanguagePreference,setLanguagePreference} from '../api';
import {createLanguageController,detectedLanguage,ownedLegacyLanguage,type LanguageMode} from './languagePreference';

export function useLanguagePreference(owner:number,telegramLanguage:string|undefined,initData?:string){
 const controller=useMemo(()=>{let storage:Storage|undefined;try{storage=window.localStorage;}catch{/* Storage may be disabled in a WebView. */}return createLanguageController({owner,storage,legacyMode:ownedLegacyLanguage(storage,owner),read:()=>getLanguagePreference(initData),write:value=>setLanguagePreference(value,initData),uuid:()=>crypto.randomUUID()});},[owner,initData]);
 const snapshot=useSyncExternalStore(controller.subscribe,controller.get,controller.get);
 useEffect(()=>{if(initData)void controller.load();const retry=()=>{if(initData)void controller.load();};window.addEventListener('online',retry);return()=>{window.removeEventListener('online',retry);};},[controller,initData]);
 const automatic=useMemo(()=>detectedLanguage(telegramLanguage,navigator.language),[telegramLanguage]);
 return {language:snapshot.mode==='auto'?automatic:snapshot.mode,mode:snapshot.mode,pending:snapshot.pending,syncError:snapshot.syncError,choose:(mode:LanguageMode)=>controller.choose(mode)};
}
