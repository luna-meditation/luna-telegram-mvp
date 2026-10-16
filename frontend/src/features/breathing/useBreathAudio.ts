import {useEffect,useRef,useState} from 'react';
import {createSceneAudioUrl} from './ambient';
export type BreathAudioMode='silent'|'ambient';
const key='luna.breathwork.audio.v1';
function preference(){try{const p=JSON.parse(localStorage.getItem(key)??'{}');return {mode:p.mode==='ambient'?'ambient' as const:'silent' as const,volume:typeof p.volume==='number'&&Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.35,muted:p.muted===true};}catch{return {mode:'silent' as const,volume:.35,muted:false};}}
export function useBreathAudio(enabled:boolean){
 const [initial]=useState(preference),[mode,setModeState]=useState<BreathAudioMode>(enabled?initial.mode:'silent'),[volume,setVolume]=useState(initial.volume),[muted,setMuted]=useState(initial.muted),[error,setError]=useState(false),audio=useRef<HTMLAudioElement|null>(null),modeRef=useRef(mode);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({mode,volume,muted}));}catch{/* Best-effort device preference, never personal memory. */}if(audio.current){audio.current.volume=volume;audio.current.muted=muted;}},[mode,volume,muted]);
 const pause=()=>audio.current?.pause();
 useEffect(()=>()=>{audio.current?.pause();if(audio.current){audio.current.removeAttribute('src');audio.current.load();}},[]);
 function start(){if(!enabled||modeRef.current==='silent')return;setError(false);try{if(!audio.current){audio.current=new Audio(createSceneAudioUrl('ocean'));audio.current.loop=true;audio.current.preload='none';}audio.current.volume=volume;audio.current.muted=muted;for(const other of document.querySelectorAll('audio'))if(other!==audio.current&&!other.paused)other.pause();void audio.current.play().catch(()=>{setError(true);audio.current?.pause();});}catch{setError(true);}}
 function setMode(next:BreathAudioMode,running:boolean){modeRef.current=enabled?next:'silent';setModeState(modeRef.current);setError(false);pause();if(running&&modeRef.current==='ambient')start();}
 return {mode,volume,setVolume,muted,setMuted,error,start,pause,setMode};
}
