import type {AppLanguage,NatalCalculation,SynastryResult} from '../../api';
import {planetName,zodiacNames,zodiacPosition} from './chartCopy';

export function placementFact(chart:NatalCalculation,id:string,language:AppLanguage){
 const planet=chart.planets.find(p=>p.id===id);if(!planet)return null;
 const uncertain=chart.uncertainPlanets.find(p=>p.id===id);
 const position=uncertain?uncertain.signs.map(i=>zodiacNames(language)[i]).join(' / '):chart.timePrecision==='unknown'?zodiacNames(language)[Math.floor(planet.longitude/30)]:zodiacPosition(planet.longitude,language);
 return planetName(id,language)+' · '+position;
}
export function pathThemes(chart:NatalCalculation,language:AppLanguage){
 const en=language==='en';
 const elements=en?['Starting and expressing. Where would a small deliberate step help?','Building and sustaining. What can you make more workable in everyday life?','Learning and connecting. Which idea is worth discussing or testing?','Noticing and caring. What helps you respond rather than react?']:['Начинать и проявляться. Где поможет небольшой осознанный шаг?','Создавать и поддерживать. Что можно сделать удобнее в повседневной жизни?','Учиться и общаться. Какую идею стоит обсудить или проверить?','Замечать и беречь. Что поможет выбрать ответ, а не действовать по инерции?'];
 const rows=[
  {id:'motivation',title:en?'Motivation':'Мотивация',planets:['sun','mars'],question:en?'What feels worth your energy right now?':'На что сейчас действительно хочется направить силы?'},
  {id:'strengths',title:en?'Strengths to cultivate':'Сильные стороны',planets:['sun','jupiter'],question:en?'Which strength do your actual experiences support?':'Какую сильную сторону подтверждает ваш реальный опыт?'},
  {id:'growth',title:en?'Personal growth':'Личное развитие',planets:['saturn','jupiter'],question:en?'What would a realistic next step look like?':'Каким мог бы быть реалистичный следующий шаг?'},
  {id:'relationships',title:en?'Relationships & values':'Отношения и ценности',planets:['venus','moon'],question:en?'What helps you feel understood and respected?':'Что помогает вам чувствовать понимание и уважение?'},
  {id:'work',title:en?'Work & learning':'Работа и обучение',planets:['mercury','saturn'],question:en?'Which working conditions help you learn and focus?':'Какие условия помогают вам учиться и сосредоточиваться?'}
 ];
 return rows.map(row=>{
  const planet=chart.planets.find(p=>p.id===row.planets[0]);
  const uncertain=chart.uncertainPlanets.find(p=>p.id===row.planets[0]);
  const signs=uncertain?.signs??(planet?[Math.floor(planet.longitude/30)]:[]);
  const reflection=[...new Set(signs.map(sign=>elements[sign%4]))].join(' ');
  return {...row,facts:row.planets.flatMap(id=>{const fact=placementFact(chart,id,language);return fact?[fact]:[];}),reflection,uncertain:Boolean(uncertain)};
 });
}
export function compatibilityThemes(comparison:SynastryResult,language:AppLanguage){
 const en=language==='en';
 const rows=[
  {id:'relationship',title:en?'Relationship themes':'Темы отношений',planets:['venus','mars','sun'],question:en?'What do you each value in the way you spend time together?':'Что каждый из вас ценит в совместном времени?'},
  {id:'communication',title:en?'Communication':'Общение',planets:['mercury'],question:en?'How can you check that you understood one another?':'Как вы можете проверить, что правильно поняли друг друга?'},
  {id:'emotions',title:en?'Emotional dynamics':'Эмоциональная динамика',planets:['moon','venus'],question:en?'What support can you ask for directly, without guessing feelings?':'О какой поддержке можно попросить прямо, не угадывая чувства?'},
  {id:'strengths',title:en?'Potential points of connection':'Возможные точки опоры',planets:[],question:en?'Which shared habits already work well for you?':'Какие совместные привычки уже помогают вашим отношениям?'},
  {id:'challenges',title:en?'Differences to discuss':'Различия для обсуждения',planets:[],question:en?'Which difference would benefit from a clear agreement?':'О каком различии полезно договориться прямо?'}
 ];
 return rows.map(row=>({...row,aspects:comparison.aspects.filter(a=>row.id==='strengths'?['trine','sextile'].includes(a.type):row.id==='challenges'?['square','opposition'].includes(a.type):row.planets.includes(a.from)||row.planets.includes(a.to)).slice(0,5)}));
}
