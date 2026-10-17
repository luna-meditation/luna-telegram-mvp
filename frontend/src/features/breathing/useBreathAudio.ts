import {useEffect,useRef,useState} from 'react';
import {BreathCuePlayer} from './BreathCuePlayer';
import type {AppLanguage} from '../../api';
import {observeAudioFocus,requestAudioFocus} from '../../audioFocus';
export type BreathAudioMode='silent'|'ambient'|'guided';
const key='luna.breathwork.audio.v1';
function preference(){try{const p=JSON.parse(localStorage.getItem(key)??'{}');return {mode:p.mode==='ambient'?'ambient' as const:p.mode==='guided'?'guided' as const:'silent' as const,volume:typeof p.volume==='number'&&Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.35,voiceVolume:typeof p.voiceVolume==='number'&&Number.isFinite(p.voiceVolume)?Math.max(0,Math.min(1,p.voiceVolume)):.7,muted:p.muted===true};}catch{return {mode:'silent' as const,volume:.35,voiceVolume:.7,muted:false};}}
export function useBreathAudio(enabled:boolean,language:AppLanguage='en',guidedEnabled=false,onInterrupted?:()=>void){
 const [initial]=useState(preference),[mode,setModeState]=useState<BreathAudioMode>(enabled&&(initial.mode!=='guided'||guidedEnabled)?initial.mode:'silent'),[volume,setVolume]=useState(initial.volume),[voiceVolume,setVoiceVolume]=useState(initial.voiceVolume),[muted,setMuted]=useState(initial.muted),[error,setError]=useState(false),audio=useRef<HTMLAudioElement|null>(null),modeRef=useRef(mode),cues=useRef<BreathCuePlayer|null>(null),focusId=useRef('breath-'+crypto.randomUUID()),interrupt=useRef(onInterrupted),audioGeneration=useRef(0);
 interrupt.current=onInterrupted;
 const cuePlayer=()=>cues.current??(cues.current=new BreathCuePlayer(()=>{if(modeRef.current==='guided')setError(true);}));
 const pause=()=>{audioGeneration.current++;audio.current?.pause();cues.current?.pause();};
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({mode,volume,voiceVolume,muted}));}catch{/* Device preference only, never personal memory. */}if(audio.current){audio.current.volume=volume;audio.current.muted=muted;}cues.current?.volume(muted?0:voiceVolume);},[mode,volume,voiceVolume,muted]);
 useEffect(()=>observeAudioFocus(focusId.current,()=>{pause();interrupt.current?.();}),[]);
 useEffect(()=>{if(mode==='guided')cuePlayer().prepare(language);},[mode,language]);
 useEffect(()=>()=>{audioGeneration.current++;audio.current?.pause();cues.current?.close();if(audio.current){audio.current.removeAttribute('src');audio.current.load();}},[]);
 function start(){
  requestAudioFocus(focusId.current,audio.current);
  if(!enabled||modeRef.current==='silent')return;setError(false);
  if(modeRef.current==='guided'&&guidedEnabled){cuePlayer().start(language);cuePlayer().volume(muted?0:voiceVolume);}
  const token=++audioGeneration.current;
  try{if(!audio.current){audio.current=new Audio('/assets/audio/soundscapes/deep-space-ambient.mp3');audio.current.loop=true;audio.current.preload='none';}audio.current.volume=volume;audio.current.muted=muted;void audio.current.play().catch(()=>{if(audioGeneration.current===token){setError(true);audio.current?.pause();}});}catch{if(audioGeneration.current===token)setError(true);}
 }
 function setMode(next:BreathAudioMode,running:boolean){
  modeRef.current=enabled&&(next!=='guided'||guidedEnabled)?next:'silent';setModeState(modeRef.current);setError(false);pause();
  if(modeRef.current==='guided')cuePlayer().prepare(language);
  if(running&&modeRef.current!=='silent')start();
 }
 function cue(practiceId:string,elapsed:number,running:boolean){if(running&&enabled&&guidedEnabled&&modeRef.current==='guided'){cues.current?.volume(muted?0:voiceVolume);cues.current?.cue(practiceId,language,elapsed);}}
 return {mode,volume,setVolume,voiceVolume,setVoiceVolume,muted,setMuted,error,start,pause,setMode,cue};
}
