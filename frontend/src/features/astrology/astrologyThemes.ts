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
  {id:'relationship',title:en?'Attraction & shared time':'Притяжение и совместное время',planets:['venus','mars','sun'],question:en?'What do you each value in the way you spend time together?':'Что каждый из вас ценит в совместном времени?'},
  {id:'communication',title:en?'Communication':'Общение',planets:['mercury'],question:en?'How can you check that you understood one another?':'Как вы можете проверить, что правильно поняли друг друга?'},
  {id:'emotions',title:en?'Emotional dynamics':'Эмоциональная динамика',planets:['moon','venus'],question:en?'What support can you ask for directly, without guessing feelings?':'О какой поддержке можно попросить прямо, не угадывая чувства?'},
  {id:'strengths',title:en?'Potential points of connection':'Возможные точки опоры',planets:[],question:en?'Which shared habits already work well for you?':'Какие совместные привычки уже помогают вашим отношениям?'},
  {id:'challenges',title:en?'Differences to discuss':'Различия для обсуждения',planets:[],question:en?'Which difference would benefit from a clear agreement?':'О каком различии полезно договориться прямо?'}
 ];
 return rows.map(row=>{
  const aspects=comparison.aspects.filter(a=>row.id==='strengths'?['trine','sextile'].includes(a.type):row.id==='challenges'?['square','opposition'].includes(a.type):row.planets.includes(a.from)||row.planets.includes(a.to)).slice(0,5);
  const easy=aspects.some(a=>['trine','sextile'].includes(a.type)),contrast=aspects.some(a=>['square','opposition'].includes(a.type));
  const meanings:Record<string,[string,string]>={
   relationship:['The selected Sun, Venus and Mars links offer a symbolic way to discuss affection, initiative and how you enjoy time together. They do not tell us whether either person is attracted.','Связи Солнца, Венеры и Марса в выбранных картах — символический повод обсудить проявления симпатии, инициативу и совместное время. Они не говорят, испытывает ли человек влечение.'],
   communication:['The Mercury links invite you to compare how you explain ideas, listen and make decisions. Try checking the meaning of a message before assuming agreement.','Связи Меркурия предлагают сравнить, как вы объясняете идеи, слушаете и принимаете решения. Уточняйте смысл сказанного, прежде чем считать, что вы согласны.'],
   emotions:['The Moon and Venus links are a starting point for discussing comfort, support and ways of showing care. Real needs are best learned by asking, not by reading a chart.','Связи Луны и Венеры помогают начать разговор об уюте, поддержке и проявлениях заботы. Реальные потребности лучше узнавать в разговоре, а не выводить из карты.'],
   strengths:['The calculated flowing links traditionally symbolize areas where cooperation may feel easier. Compare this possibility with the habits that actually support you.','Рассчитанные гармоничные связи традиционно связывают с более лёгким сотрудничеством. Сопоставьте этот символ с привычками, которые действительно поддерживают вас.'],
   challenges:['The calculated contrasting links can be used to discuss different rhythms, priorities or expectations. A difference is not a verdict; a clear agreement may matter more.','Рассчитанные напряжённые связи можно использовать для разговора о разных ритмах, приоритетах и ожиданиях. Различие — не приговор: конкретные договорённости могут быть важнее.']
  };
  const overview=!aspects.length?(en?'No supported major links were found for this theme. That is not a judgment about your relationship.':'Для этой темы не найдено поддерживаемых основных связей. Это не оценка ваших отношений.'):(en?meanings[row.id][0]:meanings[row.id][1])+(row.id==='strengths'||row.id==='challenges'?'':easy&&contrast?(en?' Both flowing and contrasting patterns are present.':' Есть и гармоничные, и напряжённые связи.'):contrast?(en?' The selected links emphasize differences to discuss.':' Выбранные связи подчёркивают различия для обсуждения.'):easy?(en?' The selected links include flowing patterns.':' Среди выбранных связей есть гармоничные.'):en?' The selected links include close conjunctions.':' Среди выбранных связей есть соединения.');
  return {...row,aspects,overview};
 });
}
