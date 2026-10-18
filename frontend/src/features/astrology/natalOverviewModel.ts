import type {AppLanguage,NatalChart} from '../../api';
import {zodiacNames} from './chartCopy';

export function natalCorePlacements(calculation:NatalChart['calculation'],language:AppLanguage){
 const en=language==='en',names=zodiacNames(language);
 return ['sun','moon','ascendant'].map(id=>{
  const planet=calculation.planets.find(p=>p.id.toLowerCase()===id),uncertain=calculation.uncertainPlanets.find(p=>p.id.toLowerCase()===id),longitude=id==='ascendant'?calculation.ascendant:planet?.longitude;
  const signs=uncertain?.signs??(longitude!==null&&longitude!==undefined?[Math.floor(((longitude%360)+360)%360/30)]:[]);
  return {id,label:id==='sun'?(en?'Sun':'Солнце'):id==='moon'?(en?'Moon':'Луна'):(en?'Rising':'Асцендент'),sign:signs.length?signs.map(n=>names[n]).join(' / '):(en?'Time needed':'Нужно время'),uncertain:Boolean(uncertain),theme:id==='sun'?(en?'Identity & direction':'Личность и направление'):id==='moon'?(en?'Emotions & inner rhythm':'Эмоции и внутренний ритм'):(en?'Your way of meeting the world':'Твой способ проявляться в мире')};
 });
}
