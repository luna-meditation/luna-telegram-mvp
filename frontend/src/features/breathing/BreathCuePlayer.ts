import voiceAssets from './voiceAssets.json';
import {breathCueAt} from './voiceCatalog';
import type {AppLanguage} from '../../api';
import type {BreathPhaseKind} from './practices';
type CueAssets=typeof voiceAssets.clips.en;

/** No independent interval/clock: each cue comes from the actual session's
 * elapsed-time phase. Missed boundaries are skipped, never played late. */
export class BreathCuePlayer{
 private context:AudioContext|null=null;
 private buffers=new Map<string,AudioBuffer>();
 private loading=new Map<AppLanguage,Promise<void>>();
 private ready=new Set<AppLanguage>();
 private source:AudioBufferSourceNode|null=null;
 private gain:GainNode|null=null;
 private lastCue:string|null=null;
 private running=false;
 private closed=false;
 private abort=new AbortController();
 constructor(private onError:()=>void){}
 private fail=()=>{if(this.closed)return;this.pause();this.onError();};
 prepare(language:AppLanguage){
  if(this.closed)return;
  try{
   const Audio=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!Audio)throw Error('audio_context_unavailable');
   this.context??=new Audio();
   // Called by an explicit mode/start tap, before awaiting network work.
   void this.context.resume().catch(this.fail);
   if(!this.loading.has(language)){
    const context=this.context,assets=voiceAssets.clips[language] as CueAssets;
    const pending=Promise.all(Object.entries(assets).map(async([phase,asset])=>{
     const response=await fetch(asset.url,{cache:'force-cache',signal:this.abort.signal});if(!response.ok)throw Error('cue_missing');
     const bytes=await response.arrayBuffer();if(bytes.byteLength>100000)throw Error('cue_too_large');
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==asset.sha256)throw Error('cue_integrity');
     const buffer=await context.decodeAudioData(bytes);if(buffer.duration>=2||Math.abs(buffer.duration-asset.durationSeconds)>.03)throw Error('cue_duration');
     if(!this.closed)this.buffers.set(language+':'+phase,buffer);
    })).then(()=>{if(!this.closed)this.ready.add(language);});
    this.loading.set(language,pending);void pending.catch(()=>{this.loading.delete(language);this.ready.delete(language);for(const phase of Object.keys(assets))this.buffers.delete(language+':'+phase);this.fail();});
   }
  }catch{this.fail();}
 }
 start(language:AppLanguage){this.lastCue=null;this.running=true;this.prepare(language);}
 cue(practiceId:string,language:AppLanguage,elapsed:number){
  if(!this.running||this.closed||!this.context||!this.ready.has(language))return;
  const cue=breathCueAt(practiceId,elapsed);if(!cue||this.lastCue===language+':'+cue.key)return;
  const buffer=this.buffers.get(language+':'+cue.phase);if(!buffer)return;
  this.lastCue=language+':'+cue.key;
  // Do not issue stale commands after loading, resuming or a frame stall.
  if(cue.phaseElapsed>.65)return;
  this.source?.stop();this.source=this.context.createBufferSource();this.source.buffer=buffer;
  this.gain??=this.context.createGain();this.source.connect(this.gain);this.gain.disconnect();this.gain.connect(this.context.destination);this.source.start();
 }
 volume(value:number){if(this.context){this.gain??=this.context.createGain();this.gain.gain.value=Math.max(0,Math.min(1,value));}}
 pause(){this.running=false;this.source?.stop();this.source=null;}
 close(){this.closed=true;this.pause();this.abort.abort();this.buffers.clear();void this.context?.close().catch(()=>undefined);}
}
export const verifiedVoicePhases=Object.keys(voiceAssets.clips.en) as BreathPhaseKind[];
