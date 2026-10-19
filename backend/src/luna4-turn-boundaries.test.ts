// 100 deterministic multi-turn boundary contracts. These do NOT prove provider
// naturalness, UI fulfilment, or full real-LLM end-to-end conversation quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveIntelligenceCommand} from './luna-intelligence-command.js';
import {retainsArtifact,relevantFollowUpActions,type IntelligenceTopic} from './luna-intelligence-turn.js';
import {savedConsultationContext,messagesAfterContextReset} from './luna31-consultation.js';

type CommandCase={id:string;en:string;ru:string;action:string;input?:Record<string,unknown>;active?:{type:string;kind?:'single'|'three'|'five'}};
const commands:CommandCase[]=[
 {id:'one',en:'Start a one-card Tarot reading.',ru:'Давай расклад Таро на одну карту.',action:'tarot.start',input:{kind:'single'}},
 {id:'three',en:'Start a three-card Tarot spread.',ru:'Сделай расклад на три карты.',action:'tarot.start',input:{kind:'three'}},
 {id:'five',en:'Start a five-card Tarot spread.',ru:'Давай расклад на пять карт.',action:'tarot.start',input:{kind:'five'}},
 {id:'another',en:'Another Tarot spread please.',ru:'Давай ещё расклад Таро.',action:'tarot.start',input:{kind:'five'},active:{type:'tarot_reading',kind:'five'}},
 {id:'numbers_in_question',en:'Start one-card Tarot. Question: I have five options.',ru:'Сделай расклад на одну карту. Вопрос: у меня пять вариантов.',action:'tarot.start',input:{kind:'single'}},
 {id:'breath_one',en:'Let’s breathe for one minute.',ru:'Давай подышим одну минуту.',action:'breathing.start'},
 {id:'breath_three',en:'Start breathing for three minutes.',ru:'Хочу подышать три минуты.',action:'breathing.start'},
 {id:'breath_box',en:'Start box breathing for one minute.',ru:'Давай квадратное дыхание на минуту.',action:'breathing.start'},
 {id:'focus',en:'Find a meditation for focus.',ru:'Подбери медитацию для концентрации.',action:'meditation.recommend'},
 {id:'sleep',en:'I want a meditation for sleep.',ru:'Хочу медитацию для сна.',action:'meditation.recommend'},
 {id:'meditation_typo',en:'Find a meditaton for focus.',ru:'Подбери медитацыю для концентрации.',action:'meditation.recommend'},
 {id:'natal',en:'Show my saved birth chart.',ru:'Покажи мою сохранённую натальную карту.',action:'astrology.natal'},
 {id:'profile_selection',en:'Let me choose a birth profile for the chart.',ru:'Дай выбрать профиль рождения для карты.',action:'astrology.natal'},
 {id:'astrology_perspective',en:'Explore this from an astrological perspective.',ru:'Посмотри на это с точки зрения астрологии.',action:'astrology.natal'},
 {id:'compatibility',en:'Check our compatibility.',ru:'Проверь нашу совместимость.',action:'astrology.compatibility'},
 {id:'new_pair',en:'Check another compatibility report.',ru:'Рассчитай новую совместимость.',action:'astrology.compatibility',active:{type:'compatibility_report'}},
 {id:'russian',en:'Change language to Russian.',ru:'Переключи язык на русский.',action:'settings.language'},
 {id:'english',en:'Switch language to English.',ru:'Измени язык на английский.',action:'settings.language'},
 {id:'cosmos',en:'Open my universe.',ru:'Открой мой космос.',action:'cosmos.open'},
 {id:'journal',en:'Open my journal.',ru:'Открой мой дневник.',action:'journal.open'},
 {id:'save_reflection',en:'I want to save a reflection.',ru:'Хочу записать мысль.',action:'journal.open'},
 {id:'garden',en:'Open Moon Garden.',ru:'Открой Лунный сад.',action:'navigation.open',input:{destination:'garden'}},
 {id:'achievements',en:'Show my achievements.',ru:'Покажи мои достижения.',action:'navigation.open',input:{destination:'achievements'}},
 {id:'journey',en:'Open journey.',ru:'Открой мой путь.',action:'navigation.open',input:{destination:'journey'}},
 {id:'support',en:'Open support.',ru:'Открой поддержку.',action:'navigation.open',input:{destination:'support'}},
 {id:'settings',en:'Open settings.',ru:'Открой настройки.',action:'navigation.open',input:{destination:'settings'}},
 {id:'history',en:'Open my saved reading.',ru:'Открой сохранённый расклад.',action:'navigation.open',input:{destination:'tarot_history'}},
 {id:'no_files',en:'Create an Excel file.',ru:'Создай Excel-файл.',action:'capability.unavailable'},
 {id:'no_engine',en:'Calculate my Human Design.',ru:'Рассчитай мой Human Design.',action:'capability.unavailable'},
 {id:'unknown_birth_time',en:'Can you calculate houses without a birth time?',ru:'Можно рассчитать дома без времени рождения?',action:'capability.unavailable'}
];
for(const c of commands)for(const language of ['ru','en'] as const)test(`multi-turn boundary ${c.id} ${language}`,()=>{
 const history:Array<{role:string;content:string;metadata:unknown}>=[{role:'user',content:language==='ru'?'Давай исследуем сохранённый расклад.':'Let’s explore my saved reading.',metadata:{}},{role:'assistant',content:language==='ru'?'Расклад открыт.':'The reading is open.',metadata:{tarot:{readingId:'71000000-0000-4000-8000-000000000001'}}},{role:'user',content:c[language],metadata:{}}];
 const resolved=resolveIntelligenceCommand(history.at(-1)!.content,c.active??{type:'tarot_reading',kind:'three'});
 assert.equal(resolved?.action,c.action);for(const [key,value]of Object.entries(c.input??{}))assert.deepEqual(resolved?.input[key],value);
 if(c.action!=='tarot.start'&&c.action!=='astrology.natal'&&c.action!=='astrology.compatibility')assert.ok(!('readingId'in resolved!.input));
});

type ContextCase={id:string;topic:IntelligenceTopic;en:string;ru:string;retain:boolean};
const contexts:ContextCase[]=[
 {id:'reversed',topic:'tarot',en:'Explain the reversed card.',ru:'Объясни перевёрнутую карту.',retain:true},
 {id:'tarot_next_step',topic:'tarot',en:'How can I apply this to my situation?',ru:'Как применить это к моей ситуации?',retain:true},
 {id:'tarot_to_meditation',topic:'tarot',en:'Find a meditation for focus.',ru:'Подбери медитацию для концентрации.',retain:false},
 {id:'tarot_to_natal',topic:'tarot',en:'Explain my natal chart.',ru:'Объясни мою натальную карту.',retain:false},
 {id:'tarot_to_wallet',topic:'tarot',en:'How many Moon Seeds do I have?',ru:'Какой у меня баланс Moon Seeds?',retain:false},
 {id:'tarot_to_day',topic:'tarot',en:'Different topic: I feel tired.',ru:'Другая тема: я устал.',retain:false},
 {id:'mercury',topic:'natal',en:'Explain Mercury in this chart.',ru:'Объясни Меркурий в этой карте.',retain:true},
 {id:'mars',topic:'natal',en:'Tell me about Mars.',ru:'Расскажи про Марс.',retain:true},
 {id:'moon',topic:'natal',en:'What does my Moon mean?',ru:'Что значит моя Луна?',retain:true},
 {id:'natal_next_step',topic:'natal',en:'What is one next step?',ru:'Какой следующий шаг?',retain:true},
 {id:'natal_to_tarot',topic:'natal',en:'Start a Tarot spread.',ru:'Сделай расклад Таро.',retain:false},
 {id:'natal_to_breath',topic:'natal',en:'Let’s breathe.',ru:'Давай подышим.',retain:false},
 {id:'natal_to_pair',topic:'natal',en:'Check compatibility.',ru:'Проверь совместимость.',retain:false},
 {id:'natal_to_sleep',topic:'natal',en:'Different topic: my sleep.',ru:'Сменим тему: мой сон.',retain:false},
 {id:'pair_communication',topic:'compatibility',en:'What about our communication?',ru:'А что у нас с общением?',retain:true},
 {id:'pair_friction',topic:'compatibility',en:'How can we understand this conflict?',ru:'Как понять этот конфликт в отношениях?',retain:true},
 {id:'pair_business',topic:'compatibility',en:'Explain our business compatibility.',ru:'Объясни нашу деловую совместимость.',retain:true},
 {id:'pair_to_tarot',topic:'compatibility',en:'Another Tarot spread.',ru:'Ещё расклад Таро.',retain:false},
 {id:'pair_to_quota',topic:'compatibility',en:'What is my Premium allowance?',ru:'Какой у меня лимит Premium?',retain:false},
 {id:'pair_to_new_topic',topic:'compatibility',en:'Let’s change the subject.',ru:'Другая тема.',retain:false}
];
for(const c of contexts)for(const language of ['ru','en'] as const)test(`multi-turn source isolation ${c.id} ${language}`,()=>{
 const id='71000000-0000-4000-8000-000000000001',metadata=c.topic==='tarot'?{tarot:{readingId:id}}:{astrology:{chartId:id,...(c.topic==='compatibility'?{secondChartId:'71000000-0000-4000-8000-000000000002'}:{})}};
 const history:Array<{role:string;content:string;metadata:unknown}>=[{role:'user',content:'Synthetic prior request',metadata:{}},{role:'assistant',content:'Synthetic verified result',metadata},{role:'user',content:c[language],metadata:{}}];
 assert.equal(retainsArtifact(history.at(-1)!.content,c.topic),c.retain);
 if(!c.retain){history.push({role:'assistant',content:'The new topic is active.',metadata:{contextReset:true}});assert.deepEqual(savedConsultationContext(history),{readingId:undefined,astrology:undefined});assert.equal(messagesAfterContextReset(history).length,1);}else{assert.ok(Object.values(savedConsultationContext(history)).some(Boolean));assert.ok(relevantFollowUpActions(['continue','journal','meditation','tarot','continue'],c.topic).length<=3);}
});
assert.equal(commands.length*2+contexts.length*2,100);
