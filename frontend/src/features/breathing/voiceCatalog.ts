import {breathPractices,breathCycleSeconds} from './practices';
import type {AppLanguage} from '../../api';
// No fabricated voice URLs or synthesized "guidance". Existing phase definitions
// are the single timeline; verified clips can be added without changing timings.
export const breathVoiceCatalog=breathPractices.map(practice=>({practiceId:practice.id,languages:{en:{verified:false,clips:null},ru:{verified:false,clips:null}},phases:practice.phases.map(p=>({...p}))}));
export function voiceAvailability(practiceId:string,language:AppLanguage){const item=breathVoiceCatalog.find(p=>p.practiceId===practiceId)?.languages[language];return{available:item?.verified===true&&item.clips!==null,reason:'verified_voice_assets_missing' as const};}
export function breathCueAt(practiceId:string,elapsed:number){const practice=breathPractices.find(p=>p.id===practiceId);if(!practice||!Number.isFinite(elapsed)||elapsed<0)return null;const cycle=breathCycleSeconds(practice),cycleIndex=Math.floor(elapsed/cycle),offset=((elapsed%cycle)+cycle)%cycle;let start=0;for(let i=0;i<practice.phases.length;i++){const phase=practice.phases[i];if(offset<start+phase.seconds)return{key:`${practice.id}:${cycleIndex}:${i}`,phase:phase.kind,phaseIndex:i,cycleIndex,phaseElapsed:offset-start,duration:phase.seconds};start+=phase.seconds;}return null;}
