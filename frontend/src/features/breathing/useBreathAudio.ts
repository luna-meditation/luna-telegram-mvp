import {useEffect,useRef,useState} from 'react';
import {BreathCuePlayer} from './BreathCuePlayer';
import type {AppLanguage} from '../../api';
export type BreathAudioMode='silent'|'ambient'|'guided';
const key='luna.breathwork.audio.v1';
function preference(){try{const p=JSON.parse(localStorage.getItem(key)??'{}');return {mode:p.mode==='ambient'?'ambient' as const:p.mode==='guided'?'guided' as const:'silent' as const,volume:typeof p.volume==='number'&&Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.35,muted:p.muted===true};}catch{return {mode:'silent' as const,volume:.35,muted:false};}}
export function useBreathAudio(enabled:boolean,language:AppLanguage='en',guidedEnabled=false){
 const [initial]=useState(preference),[mode,setModeState]=useState<BreathAudioMode>(enabled&&(initial.mode!=='guided'||guidedEnabled)?initial.mode:'silent'),[volume,setVolume]=useState(initial.volume),[muted,setMuted]=useState(initial.muted),[error,setError]=useState(false),audio=useRef<HTMLAudioElement|null>(null),modeRef=useRef(mode),cues=useRef<BreathCuePlayer|null>(null);
 const cuePlayer=()=>cues.current??(cues.current=new BreathCuePlayer(()=>setError(true)));
 const pause=()=>{audio.current?.pause();cues.current?.pause();};
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({mode,volume,muted}));}catch{/* Device preference only, never personal memory. */}if(audio.current){audio.current.volume=volume;audio.current.muted=muted;}cues.current?.volume(muted?0:volume);},[mode,volume,muted]);
 useEffect(()=>{if(mode==='guided')cuePlayer().prepare(language);},[mode,language]);
 useEffect(()=>()=>{audio.current?.pause();cues.current?.close();if(audio.current){audio.current.removeAttribute('src');audio.current.load();}},[]);
 function start(){
  for(const other of document.querySelectorAll('audio'))if(other!==audio.current&&!other.paused)other.pause();
  if(!enabled||modeRef.current==='silent')return;setError(false);
  if(modeRef.current==='guided'){if(guidedEnabled){cuePlayer().start(language);cuePlayer().volume(muted?0:volume);}return;}
  try{if(!audio.current){audio.current=new Audio('/assets/audio/soundscapes/deep-space-ambient.mp3');audio.current.loop=true;audio.current.preload='none';}audio.current.volume=volume;audio.current.muted=muted;void audio.current.play().catch(()=>{setError(true);audio.current?.pause();});}catch{setError(true);}
 }
 function setMode(next:BreathAudioMode,running:boolean){
  modeRef.current=enabled&&(next!=='guided'||guidedEnabled)?next:'silent';setModeState(modeRef.current);setError(false);pause();
  if(modeRef.current==='guided')cuePlayer().prepare(language);
  if(running&&modeRef.current!=='silent')start();
 }
 function cue(practiceId:string,elapsed:number,running:boolean){if(running&&enabled&&guidedEnabled&&modeRef.current==='guided'){cues.current?.volume(muted?0:volume);cues.current?.cue(practiceId,language,elapsed);}}
 return {mode,volume,setVolume,muted,setMuted,error,start,pause,setMode,cue};
}
