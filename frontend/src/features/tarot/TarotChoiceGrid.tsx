import {TarotCardBack} from './TarotCard';
import type {AppLanguage} from '../../api';
/** Selection-only view shared by standalone and chat flows. It never draws,
 * generates an interpretation, grants access, or changes a wallet. */
export function TarotChoiceGrid({language,slots=5,selected,disabled=false,onChoose}:{language:AppLanguage;slots?:number;selected:number[];disabled?:boolean;onChoose:(slot:number)=>void}){
 return <div className="tarot-choice-grid" role="group" aria-label={language==='ru'?'Выбери закрытые карты':'Choose face-down cards'}>{Array.from({length:slots},(_,slot)=>{
  const index=selected.indexOf(slot);return <button type="button" key={slot} disabled={disabled||index>=0} aria-pressed={index>=0} aria-label={`${language==='ru'?'Выбрать карту':'Choose card'} ${slot+1}`} onClick={()=>onChoose(slot)}><TarotCardBack/><span>{index>=0?`✓ ${index+1}`:slot+1}</span></button>;
 })}</div>;
}
