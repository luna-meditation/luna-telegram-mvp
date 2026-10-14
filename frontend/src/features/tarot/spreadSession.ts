import type {TarotReading,TarotSelection,AppLanguage} from '../../api';
export type SpreadKind='three'|'five';
export type SpreadSession={kind:SpreadKind;stage:'intention'|'shuffling'|'choose'|'reveal'|'interpretation';intention:TarotReading['intention'];question:string;choices:string[];selected:Array<TarotSelection&{slot:number}>;revealed:number;clientReadingId?:string;language?:AppLanguage;reading?:TarotReading};
export type SpreadAction={type:'intention';value:SpreadSession['intention']}|{type:'question';value:string}|{type:'shuffle';choices:string[];clientReadingId:string;language:AppLanguage}|{type:'ready'}|{type:'choose';slot:number;orientation:TarotSelection['orientation']}|{type:'reveal';index:number}|{type:'saved';reading:TarotReading}|{type:'reset'};
export function createSpreadSession(kind:SpreadKind):SpreadSession{return {kind,stage:'intention',intention:'general',question:'',choices:[],selected:[],revealed:0};}
export function reduceSpreadSession(state:SpreadSession,action:SpreadAction):SpreadSession{
 const size=state.kind==='three'?3:5;
 switch(action.type){
  case 'intention':return state.stage==='intention'&&['general','love','career','growth'].includes(action.value)?{...state,intention:action.value}:state;
  case 'question':return state.stage==='intention'?{...state,question:action.value.slice(0,240)}:state;
  case 'shuffle':return state.stage==='intention'&&action.choices.length===5&&new Set(action.choices).size===5?{...state,stage:'shuffling',choices:action.choices,clientReadingId:action.clientReadingId,language:action.language,question:state.question.trim()}:state;
  case 'ready':return state.stage==='shuffling'?{...state,stage:'choose'}:state;
  case 'choose':{
   if(state.stage!=='choose'||!Number.isInteger(action.slot)||action.slot<0||action.slot>=5||state.selected.some(c=>c.slot===action.slot)||!['upright','reversed'].includes(action.orientation))return state;
   const selected=[...state.selected,{slot:action.slot,cardId:state.choices[action.slot],orientation:action.orientation}];
   return {...state,selected,stage:selected.length===size?'reveal':'choose'};
  }
  case 'reveal':return state.stage==='reveal'&&action.index===state.revealed&&state.revealed<size?{...state,revealed:state.revealed+1,stage:state.revealed+1===size?'interpretation':'reveal'}:state;
  case 'saved':return state.clientReadingId===action.reading.client_reading_id&&!(state.reading?.status==='ready'&&action.reading.status!=='ready')?{...state,reading:action.reading}:state;
  case 'reset':return createSpreadSession(state.kind);
 }
}
