/** A deterministic personal reflection, never a current-transit forecast. */
type TransitSnapshot={at:string;engine:{version:string};aspects:Array<{transiting:string;natal:string;type:string;orb:number}>;excludedNatalPlanets:string[]};
export const dailyEntryVersion='luna-companion-reflection-v2';
export type DailyPersonalEntry={version:1;key:string;localDate:string;timeZone:string;language?:'en'|'ru';greeting:string;question:string;audience?:'new'|'returning';reflection:null|{text:string;basis:string;source:'saved_chart'|'date_only_sun'|'confirmed_goal';calculationVersion:string};birthAvailable:boolean;hasBirthTime:boolean;contextReflectionAllowed:boolean};
export function localCalendarDate(now:Date,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(name=>parts.find(p=>p.type===name)!.value).join('-');
}
const reflections={en:[
 'You could begin one thing you have been putting off with a step small enough to take today. Starting does not commit you to doing everything at once.',
 'Give one useful routine a little room today. It could be eating without rushing or leaving a pause between tasks.',
 'If several ideas are competing for your attention, choose one to explore for ten minutes. You can return to the others later.',
 'It is possible to care about someone without taking responsibility for everything they feel. Leave a little room for what you need, too.',
 'Try giving one idea a voice before deciding whether anyone will approve of it. You could first share it with someone you trust or write it down for yourself.',
 'Choose one thing that would be good enough for today. Finishing a small useful task can matter more than getting every detail right.',
 'In one conversation, you could say what you need before trying to find a compromise. Listening and having your own voice can go together.',
 'There may be a question you do not need to settle immediately. You can notice what you feel without forcing a final answer today.',
 'A small experiment can tell you more than another long list of possibilities. Try something you can easily change your mind about.',
 'Make one plan a little kinder to yourself: fewer steps, a realistic time, or permission to ask for help. A plan should support you.',
 'You can make room for an idea of your own without working everything out alone. Consider who could help you think it through.',
 'Give one feeling or idea a concrete place: a few written lines, a sketch, or a quiet walk. You do not need to explain it perfectly.'
],ru:[
 'Можно начать одно отложенное дело с шага, который реально сделать сегодня. Начало не обязывает сразу доводить всё до конца.',
 'Оставь немного места для простой привычки, которая тебя поддерживает: поесть без спешки или сделать паузу между делами.',
 'Если идей много, выбери одну и удели ей десять минут. К остальным можно вернуться позже.',
 'Можно заботиться о близком человеке, не отвечая за все его чувства. Пусть останется немного места и для твоих потребностей.',
 'Попробуй дать своей идее прозвучать до того, как решишь, одобрят ли её другие. Можно сначала записать её для себя или поделиться с тем, кому доверяешь.',
 'Выбери одно дело, которое сегодня достаточно сделать хорошо, без требования идеала. Небольшой законченный шаг тоже имеет значение.',
 'В одном разговоре можно сначала назвать свою потребность, а потом искать компромисс. Слышать другого и сохранять свой голос вполне совместимо.',
 'Не на каждый вопрос нужен окончательный ответ прямо сейчас. Можно заметить свои чувства и оставить решение до более ясного момента.',
 'Небольшая проба может дать больше ясности, чем ещё один список возможностей. Выбери то, что легко попробовать и так же легко изменить.',
 'Сделай один план бережнее к себе: меньше шагов, реалистичный срок или возможность попросить о помощи. План должен тебя поддерживать.',
 'Для собственной идеи не обязательно разбираться во всём в одиночку. Подумай, с кем можно спокойно её обсудить.',
 'Дай одному чувству или замыслу конкретное место: несколько строк, рисунок или спокойную прогулку. Необязательно сразу находить идеальные слова.'
]};
export function solarDailyReflection(input:{language:'en'|'ru';localDate:string;sunSigns:number[];source:'saved_chart'|'date_only_sun'}){
 const indices=[...new Set(input.sunSigns)].filter(n=>Number.isInteger(n)&&n>=0&&n<12);if(indices.length!==1)return null;
 const en=input.language==='en';
 return {text:reflections[input.language][indices[0]],basis:en?(input.source==='saved_chart'?'A reflection inspired by your saved birth chart, not a forecast.':'A reflection from your saved birth date, not a full chart or forecast.'):(input.source==='saved_chart'?'Размышление по сохранённой карте рождения, не прогноз.':'Размышление по сохранённой дате рождения, не полная карта и не прогноз.'),source:input.source,calculationVersion:dailyEntryVersion};
}

/** Editorial prose for one ACTUALLY calculated aspect, with its exact source.
 * A symbolic focus is not a claim about the user's mood or future events. */
export function transitDailyReflection(snapshot:TransitSnapshot,language:'en'|'ru'){
 const themes={
  moon:{en:'Leave a little room to notice what you need before saying yes to someone else. A pause can make a kind answer more honest.',ru:'Прежде чем соглашаться на чужую просьбу, оставь немного места для своей потребности. Пауза может сделать добрый ответ честнее.'},
  mercury:{en:'For a conversation that matters to you, choose the one thing you most want to make clear. You can be direct without explaining everything at once.',ru:'Для важного разговора выбери одну мысль, которую тебе особенно хочется донести. Можно говорить прямо, не объясняя всё сразу.'},
  venus:{en:'Notice the difference between what you truly value and what would simply earn approval. Give one small choice to the former today.',ru:'Заметь разницу между тем, что для тебя ценно, и тем, что просто заслужит одобрение. Сегодня можно сделать один небольшой выбор в пользу первого.'},
  mars:{en:'Choose where you want to spend your effort, and where a clear boundary would serve you better. Not every demand needs an immediate yes.',ru:'Выбери, куда хочется направить силы, а где больше поможет ясная граница. Не на каждое требование нужно сразу отвечать согласием.'}
 };
 const names:Record<string,{en:string;ru:string}>={sun:{en:'Sun',ru:'Солнце'},moon:{en:'Moon',ru:'Луна'},mercury:{en:'Mercury',ru:'Меркурий'},venus:{en:'Venus',ru:'Венера'},mars:{en:'Mars',ru:'Марс'},jupiter:{en:'Jupiter',ru:'Юпитер'},saturn:{en:'Saturn',ru:'Сатурн'},uranus:{en:'Uranus',ru:'Уран'},neptune:{en:'Neptune',ru:'Нептун'},pluto:{en:'Pluto',ru:'Плутон'}};
 const aspects:Record<string,{en:string;ru:string}>={conjunction:{en:'conjunction',ru:'соединение'},sextile:{en:'sextile',ru:'секстиль'},square:{en:'square',ru:'квадрат'},trine:{en:'trine',ru:'трин'},opposition:{en:'opposition',ru:'оппозиция'}};
 const aspect=snapshot.aspects.find(value=>Object.prototype.hasOwnProperty.call(themes,value.transiting)&&names[value.natal]&&aspects[value.type]&&!snapshot.excludedNatalPlanets.includes(value.natal));
 if(!aspect)return null;
 const en=language==='en',date=snapshot.at.slice(0,10),time=snapshot.at.slice(11,16),moving=names[aspect.transiting][language],target=names[aspect.natal][language],link=aspects[aspect.type][language];
 return{text:themes[aspect.transiting as keyof typeof themes][language],basis:en?`${date}, ${time} UTC: transiting ${moving} ${link} natal ${target}. A symbolic reflection, not an event prediction.`:`${date}, ${time} UTC: транзит ${moving} — ${link} — ${target} в карте рождения. Символическое размышление, не прогноз событий.`,source:'saved_chart' as const,calculationVersion:dailyEntryVersion+':'+snapshot.engine.version+':'+snapshot.at};
}
