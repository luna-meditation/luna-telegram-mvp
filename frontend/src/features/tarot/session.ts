import type {TarotOrientation} from './deck';
import type {TarotReading} from '../../api';
export const tarotIntentions=['general','love','career','growth'] as const;
export type TarotIntention=typeof tarotIntentions[number];
export type TarotSession={
 stage:'intention'|'shuffling'|'choose'|'reveal'|'interpretation';
 intention:TarotIntention;
 question:string;
 choices:readonly string[];
 shuffledAt:number;
 result:{cardId:string;orientation:TarotOrientation;slot:number}|null;
 serial:number;
 clientReadingId?:string;
 readingLanguage?:'en'|'ru';
 savedReading?:TarotReading;
};
export type TarotAction=
 |{type:'intention';value:TarotIntention}
 |{type:'question';value:string}
 |{type:'shuffle';choices:readonly string[];at:number;clientReadingId?:string;language?:'en'|'ru'}
 |{type:'saved';reading:TarotReading}
 |{type:'resume';reading:TarotReading}
 |{type:'deleted';id:string}
 |{type:'ready'}
 |{type:'choose';slot:number;orientation:TarotOrientation}
 |{type:'reveal'}
 |{type:'reset'};
export function createTarotSession():TarotSession {
 return {stage:'intention',intention:'general',question:'',choices:[],shuffledAt:0,result:null,serial:0};
}
// App-owned state survives tab transitions; optional server history uses the same flow.
export function reduceTarotSession(state:TarotSession,action:TarotAction):TarotSession {
 switch(action.type){
  case 'intention': return state.stage==='intention'&&tarotIntentions.includes(action.value)?{...state,intention:action.value}:state;
  case 'question': return state.stage==='intention'?{...state,question:action.value.slice(0,240)}:state;
  case 'shuffle': {
   if(state.stage!=='intention'||action.choices.length!==5||new Set(action.choices).size!==5||!Number.isFinite(action.at))return state;
   return {...state,stage:'shuffling',choices:[...action.choices],question:state.question.trim(),shuffledAt:action.at,clientReadingId:action.clientReadingId,readingLanguage:action.language};
  }
  case 'ready': return state.stage==='shuffling'?{...state,stage:'choose'}:state;
  case 'choose': {
   if(state.stage!=='choose'||state.result||!Number.isInteger(action.slot)||action.slot<0||action.slot>=state.choices.length||!['upright','reversed'].includes(action.orientation))return state;
   return {...state,stage:'reveal',result:{cardId:state.choices[action.slot],orientation:action.orientation,slot:action.slot}};
  }
  case 'reveal': return state.stage==='reveal'&&state.result?{...state,stage:'interpretation'}:state;
  case 'saved': return state.clientReadingId===action.reading.client_reading_id&&!(state.savedReading?.status==='ready'&&action.reading.status!=='ready')?{...state,savedReading:action.reading}:state;
  case 'resume': return {...createTarotSession(),stage:'interpretation',intention:action.reading.intention,question:action.reading.question,clientReadingId:action.reading.client_reading_id,readingLanguage:action.reading.language,savedReading:action.reading,result:{cardId:action.reading.card_id,orientation:action.reading.orientation,slot:0},serial:state.serial+1};
  case 'deleted': return state.savedReading?.id===action.id?{...createTarotSession(),serial:state.serial+1}:state;
  case 'reset': return {...createTarotSession(),serial:state.serial+1};
 }
}
