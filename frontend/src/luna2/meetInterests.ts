import type {AppLanguage,UniverseData} from '../api';
import {meetInterestOptions} from '../../../backend/src/luna42-meet-config';

/** A deliberately written replacement is authoritative, not an extra set of
 * inferred enum preferences. Never parse arbitrary user text as JSON labels. */
export function meetInterestLabels(data:UniverseData,language:AppLanguage):string[]{
 const saved=data.memories.find(m=>m.memory_key==='meet_interests'&&m.confirmation_status==='confirmed'&&m.memory_kind==='fact');
 let ids:string[]=data.profile.interests;
 if(saved){
  try{const value:unknown=JSON.parse(saved.memory_value);if(Array.isArray(value)&&value.every(id=>typeof id==='string'&&meetInterestOptions.some(option=>option[0]===id)))ids=value;else return [saved.memory_value];}
  catch{return [saved.memory_value];}
 }
 return ids.map(id=>meetInterestOptions.find(option=>option[0]===id)?.[language==='en'?1:2]??id);
}
