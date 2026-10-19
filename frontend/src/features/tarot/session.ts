import type {TarotOrientation} from './deck';
import type {TarotReading,DailyTarotResult} from '../../api';
import {createSpreadSession,reduceSpreadSession,type SpreadSession,type SpreadAction,type SpreadKind} from './spreadSession';
export const tarotIntentions=['general','love','career','growth'] as const;
export type TarotIntention=typeof tarotIntentions[number];
export type TarotSession={
 screen?:'hub'|'single'|'daily'|'three'|'five'|'history';
 daily?:DailyTarotResult;
 spreads?:Partial<Record<SpreadKind,SpreadSession>>;
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
 orderId?:string;
};
export type TarotAction=
 |{type:'screen';value:NonNullable<TarotSession['screen']>}
 |{type:'daily';value:DailyTarotResult}
 |{type:'spread';kind:SpreadKind;action:SpreadAction}
 |{type:'intention';value:TarotIntention}
 |{type:'question';value:string}
 |{type:'shuffle';choices:readonly string[];at:number;clientReadingId?:string;language?:'en'|'ru'}
 |{type:'saved';reading:TarotReading}
 |{type:'order';id:string}
 |{type:'retry_access';clientReadingId:string}
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
  case 'screen': return {...state,screen:action.value};
  case 'daily': return state.daily?.reading.status==='ready'&&state.daily.reading.id===action.value.reading.id&&action.value.reading.status!=='ready'?state:{...state,daily:action.value};
  case 'spread':return {...state,spreads:{...state.spreads,[action.kind]:reduceSpreadSession(state.spreads?.[action.kind]??createSpreadSession(action.kind),action.action)}};
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
  case 'order':return state.stage==='interpretation'&&!state.orderId?{...state,orderId:action.id}:state;
  case 'retry_access':return state.stage==='interpretation'&&state.savedReading?.status==='fallback'&&state.orderId?{...state,clientReadingId:action.clientReadingId,savedReading:undefined}:state;
  case 'resume': {
   const r=action.reading,kind=r.reading_kind;
   if((kind==='three'||kind==='five')&&r.cards?.length===(kind==='three'?3:5))return {...state,screen:kind,spreads:{...state.spreads,[kind]:{...createSpreadSession(kind),stage:'interpretation',intention:r.intention,question:r.question,selected:r.cards.map((c,slot)=>({...c,slot})),revealed:r.cards.length,clientReadingId:r.client_reading_id,language:r.language,reading:r}}};
   return {...createTarotSession(),screen:'single',daily:state.daily,spreads:state.spreads,stage:'interpretation',intention:r.intention,question:r.question,clientReadingId:r.client_reading_id,readingLanguage:r.language,savedReading:r,result:{cardId:r.card_id,orientation:r.orientation,slot:0},serial:state.serial+1};
  }
  case 'deleted': {
   let next=state.savedReading?.id===action.id?{...createTarotSession(),screen:'hub' as const,daily:state.daily,spreads:state.spreads,serial:state.serial+1}:state;
   if(next.daily?.reading.id===action.id)next={...next,daily:undefined,screen:next.screen==='daily'?'hub':next.screen};
   for(const kind of ['three','five'] as const)if(next.spreads?.[kind]?.reading?.id===action.id)next={...next,spreads:{...next.spreads,[kind]:createSpreadSession(kind)},screen:next.screen===kind?'hub':next.screen};
   return next;
  }
  case 'reset': return {...createTarotSession(),screen:state.screen,daily:state.daily,spreads:state.spreads,serial:state.serial+1};
 }
}
