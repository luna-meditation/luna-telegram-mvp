import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {resolveIntelligenceCommand} from './luna-intelligence-command.js';
import {artifactTopic,retainsArtifact,relevantFollowUpActions,responsePlan,numerologyQuickReplies} from './luna-intelligence-turn.js';
import {calculateDateNumerology,reduceNumber} from './luna-intelligence-numerology.js';
import {verifiedNumerologyContext,namedTransitFacts} from './luna-intelligence-personal-context.js';
import {createLunaTools,runLunaToolTurn} from './luna32-tools.js';
import {calculateNatalChart,calculateCurrentTransits} from './luna30-astrology-engine.js';
import {artifactScopedRecent,assertGroundedAstrologyProse,assertGroundedNumerologyProse} from './luna-intelligence-grounding.js';
test('unknown-time calculated charts cannot acquire invented planet-in-house assertions',()=>{
 const context={first:{subject:{label:'Synthetic',kind:'self'},placements:{sun:'Capricorn',mercury:'Capricorn'},ascendant:null,aspects:[]}};
 for(const text of ['Солнце в 3-м доме','Mercury in the 10th house','Sun is in the 1st house'])assert.throws(()=>assertGroundedAstrologyProse(text,context),/ungrounded_chart_house/);
 for(const text of ['Без времени рождения дома не определены.','We cannot calculate houses from this chart.','Меркурий в Козероге.'])assert.doesNotThrow(()=>assertGroundedAstrologyProse(text,context));
});
Object.assign(process.env,{BOT_TOKEN:'local-test',BOT_USERNAME:'local_test_bot',MINI_APP_URL:'https://example.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'local-test'});
const {buildDeepAnalysisRequest,deepContextHash}=await import('./luna43-seed-products.js');

test('reported iPhone commands distinguish natal charts, perspective, new spreads and history',()=>{
 for(const text of ['Посмотри мою натальную карту','Давай посмотрим на это с астрологической точки зрения','Look at my birth chart','Let’s see this through astrology'])assert.equal(resolveIntelligenceCommand(text)?.action,'astrology.natal',text);
 for(const text of ['Раскинем карты','Давай расклад на 5 карт про работу','Let’s draw five cards about my project'])assert.equal(resolveIntelligenceCommand(text)?.action,'tarot.start',text);
 assert.equal(resolveIntelligenceCommand('Давай расклад на 5 карт про работу')?.input.kind,'five');
 assert.match(String(resolveIntelligenceCommand('Давай расклад на 5 карт про работу')?.input.question),/работ/);
 assert.equal(resolveIntelligenceCommand('Покажи последний расклад')?.input.destination,'tarot_history');
 assert.equal(resolveIntelligenceCommand('С астрологической точки зрения',{type:'natal_chart'}),null);
 for(const type of ['natal_chart','compatibility_report','tarot_reading'])for(const message of ['Посмотри мою натальную карту.','Look at my birth chart.'])assert.equal(resolveIntelligenceCommand(message,{type})?.action,'astrology.natal');
});
test('verified chart labels and technical facts cannot be replaced with invented identities or placements',()=>{
 const first={subject:{label:'Synthetic A',kind:'self'},placements:{sun:'Capricorn 10.2°',mercury:'Capricorn 1.8°'},ascendant:'Aries',aspects:[{from:'sun',to:'saturn',type:'trine'}]};
 const context={first,second:{...first,subject:{label:'Synthetic B',kind:'other'},placements:{sun:'Leo'},ascendant:null,aspects:[]},synastry:{aspects:[{from:'mars',to:'sun',type:'opposition'}]}};
 for(const value of ['первый профиль — Артем/Alex','второй профиль — Robert','Меркурий в Стрельце','Асцендент в Рыбах','Солнце в оппозиции к Сатурну'])assert.throws(()=>assertGroundedAstrologyProse(value,context,'Alex'),value);
 for(const value of ['первый профиль — Synthetic A','Солнце в Козероге','Меркурий в Козероге','Марс в оппозиции к Солнцу'])assert.doesNotThrow(()=>assertGroundedAstrologyProse(value,context,'Alex'),value);
 assert.throws(()=>assertGroundedAstrologyProse('Для второго профиля: Асцендент в Овне',context));
 assert.doesNotThrow(()=>assertGroundedAstrologyProse('Солнце в Весах',context,undefined,{current:[{id:'sun',sign:6}],aspects:[]}));
 assert.doesNotThrow(()=>assertGroundedAstrologyProse('Меркурий в Козероге, Марс в оппозиции к Солнцу',context));
 assert.throws(()=>assertGroundedAstrologyProse('Mercury opposite Sun',context));
 const pair={...context,synastry:{aspects:[{from:'moon',to:'saturn',type:'square'},{from:'moon',to:'uranus',type:'sextile'},{from:'saturn',to:'mercury',type:'square'}]}};
 assert.doesNotThrow(()=>assertGroundedAstrologyProse('Квадрат Луны A к Сатурну B может быть темой для размышления.',pair));
 for(const prose of ['Квадрат Луны A к Сатурну/меркурию B и к Урану даёт риск недопонимания.','Квадрат Луны A к Урану B.','Square Moon A to Mercury B.','Трины и секстили (например, Юпитер к Солнцу/Марсу и трин Венеры с Сатурном) дают ресурс.','Трин Луны к Сатурну.'])assert.throws(()=>assertGroundedAstrologyProse(prose,pair),/ungrounded_chart_aspect/);
});
test('changing the selected artifact withholds old assistant inferences but does not erase saved history',()=>{
 const messages=[{role:'assistant',metadata:{readingId:'reading'}},{role:'user',content:'different chart'},{role:'assistant',metadata:{astrology:{chartId:'a',secondChartId:'b'}}},{role:'user',content:'Explain Mercury'}];
 assert.deepEqual(artifactScopedRecent(messages,{chartId:'a'}),messages.slice(3));assert.equal(messages.length,4);
 assert.deepEqual(artifactScopedRecent(messages,{chartId:'a',secondChartId:'b'}),messages.slice(1));
});
test('follow-up retains exact domain; explicit new topic beats even a fresh attachment',()=>{
 for(const text of ['Мои сильные стороны','Что это значит для меня?','А с работой?','My strengths','What does this mean for my situation?'])assert.ok(retainsArtifact(text,'natal'),text);
 for(const text of ['Почему мы ссоримся?','How can we communicate better?','Что может нас сближать?'])assert.ok(retainsArtifact(text,'compatibility'),text);
 for(const text of ['Different topic: help me choose a prototype step','Кстати, я плохо спал','Подбери медитацию','Открой настройки языка'])assert.equal(retainsArtifact(text,'tarot'),false,text);
 assert.equal(retainsArtifact('Подбери медитацию','natal',true),false);
 assert.equal(retainsArtifact('Посмотри мою натальную карту','tarot',true),false);
 assert.equal(artifactTopic({astrology:{chartId:'a',secondChartId:'b'}}),'compatibility');
 assert.deepEqual(relevantFollowUpActions(['tarot','meditation','breathing'],'general'),[]);
 assert.deepEqual(relevantFollowUpActions(['continue','tarot','continue','journal'],'compatibility'),['continue','journal']);
 assert.equal(responsePlan('Мои сильные стороны','natal').depth,'concise');
});
test('versioned date numerology uses documented reductions and strict Gregorian dates',()=>{
 assert.equal(reduceNumber(11),11);assert.equal(reduceNumber(22),22);assert.equal(reduceNumber(33),33);assert.equal(reduceNumber(11,false),2);
 const chart=calculateDateNumerology('1990-01-01','2026-10-18');
 assert.deepEqual([chart.lifePath,chart.birthday,chart.personalYear,chart.personalMonth,chart.personalDay],[3,1,3,4,22%9]);
 const master=calculateDateNumerology('2000-02-29','2026-10-18');assert.equal(master.lifePath,6);assert.equal(master.birthday,11);
 assert.equal(chart.nature,'symbolic_not_scientific');assert.doesNotMatch(JSON.stringify(chart),/1990-01-01/);
 for(const date of ['2025-02-29','2000-02-30','01/01/1990','2201-01-01'])assert.throws(()=>calculateDateNumerology(date,'2026-10-18'));
 assert.throws(()=>calculateDateNumerology('2027-01-01','2026-10-18'));
});
test('numeric follow-ups offer supported discussion, not arbitrary-year calculations',()=>{
 for(const language of ['ru','en'] as const){const replies=numerologyQuickReplies(language);assert.equal(replies.length,2);assert.doesNotMatch(replies.join(' '),/calculate|рассчит|другой год|different year/i);assert.equal(new Set(replies).size,2);}
 assert.match(numerologyQuickReplies('ru')[0],/моей цели/);assert.match(numerologyQuickReplies('en')[1],/limits/);
});
test('numerology is owner/consent scoped and never returns raw birth information',async()=>{
 const seen:string[]=[];const db=createClient('https://staging.invalid','qa',{auth:{persistSession:false},global:{fetch:async url=>{seen.push(String(url));return Response.json([{id:'00000000-0000-4000-8000-000000000001',birth_date:'1990-01-01',subject_kind:'self'}]);}}});
 assert.equal((await verifiedNumerologyContext(db,12,{consented:false})).calculated,false);assert.equal(seen.length,0);
 const value=await verifiedNumerologyContext(db,12,{consented:true,asOf:'2026-10-18'});assert.equal(value.calculated,true);assert.ok(seen[0].includes('telegram_id=eq.12'));assert.ok(seen[0].includes('subject_kind=eq.self'));assert.doesNotMatch(JSON.stringify(value),/1990-01-01/);
});
test('numeric prose must match calculated values and not invent unrequested arithmetic rules',()=>{
 const facts=calculateDateNumerology('2000-01-01','2026-10-18'),request='Explain my Life Path and personal year, with symbolic limits.';
 assert.doesNotThrow(()=>assertGroundedNumerologyProse('Your Life Path is 4 and Personal Year is 3. These are symbolic reflection prompts, not scientific predictions.',facts,request));
 for(const text of ['Your Life Path is 7.','Личный год: 9.','Master numbers are retained only during intermediate reductions.','Reflection '.repeat(201)])assert.throws(()=>assertGroundedNumerologyProse(text,facts,request));
 assert.doesNotThrow(()=>assertGroundedNumerologyProse('Master numbers 11/22/33 survive each Life Path stage, including the final sum. Calendar periods reduce to 1–9.',facts,'Explain the master-number method.'));
});
test('Intelligence allows lookup then action, forces a final answer after the action',async()=>{
 const db=createClient('https://staging.invalid','qa',{auth:{persistSession:false}}),id='00000000-0000-4000-8000-000000000051';
 const registry=createLunaTools({db,owner:12,language:'en',readingContext:null,catalog:[{id,title:'Focus',durationSeconds:180,premium:false,published:true,language:'en',audioLanguage:'en'}],personalContext:null,access:{hasPremium:true},quota:async()=>({remaining:5}),astrologyEnabled:false});
 const requests:Array<Record<string,unknown>>=[];
 const result=await runLunaToolTurn({input:[]},registry,async body=>{requests.push(body);return requests.length===1?{status:'completed',usage:{input_tokens:10,output_tokens:2},output:[{type:'function_call',name:'get_meditation_catalog',arguments:'{}',call_id:'a'}]}:requests.length===2?{status:'completed',usage:{input_tokens:20,output_tokens:3},output:[{type:'function_call',name:'recommend_meditation',arguments:JSON.stringify({id}),call_id:'b'}]}:{status:'completed',usage:{input_tokens:30,output_tokens:4},output:[]};},{maxToolRounds:2});
 assert.deepEqual(requests.map(r=>r.tool_choice),['auto','auto','none']);assert.equal(registry.meditationSelection()?.id,id);assert.deepEqual(result.usage,{input_tokens:60,output_tokens:9});assert.equal(registry.outcomes().length,2);
});
test('transits use real timestamped engine positions and omit uncertain natal precision',()=>{
 const natal=calculateNatalChart({date:'2000-01-01',time:null,location:{placeId:'fixture',label:'London',latitude:51.5074,longitude:-.1278,timezone:'Europe/London',provider:'synthetic',confirmed:true}});
 const first=calculateCurrentTransits(natal,'2026-10-18T00:00:00Z'),later=calculateCurrentTransits(natal,'2026-10-19T00:00:00Z');
 assert.equal(first.current.length,10);assert.notDeepEqual(first.current,later.current);assert.ok(first.excludedNatalPlanets.includes('moon'));assert.ok(first.aspects.every(a=>a.natal!=='moon'));assert.equal(first.housesIncluded,false);assert.equal(first.predictiveClaim,false);assert.throws(()=>calculateCurrentTransits(natal,'invalid'));
 const named=namedTransitFacts(first);assert.equal(named.current.find(p=>p.id==='sun')?.signName,'Libra');assert.equal(named.current.find(p=>p.id==='sun')?.signNameRu,'Весы');assert.ok(named.aspects.every(a=>a.labelRu.includes('натальная карта:')&&a.labelEn.startsWith('transiting ')));assert.deepEqual(named.aspects.map(a=>({transiting:a.transiting,natal:a.natal,type:a.type,orb:a.orb})),first.aspects);
});
test('deep report has a concrete topic and legacy paid contexts keep their exact hash',()=>{
 const memory={category:'goals',key:'prototype',value:'Make one useful prototype',updatedAt:'2026-10-18'},base={language:'en' as const,question:'Which step matters?',personal:{displayName:'Alex',confirmedMemories:[memory]},sources:[{id:'confirmed_0',kind:'confirmed' as const,label:'prototype',data:memory}]};
 const enriched={...base,personal:{...base.personal,confirmedMemories:[{...memory,id:'a',source:'user_edit',confirmation:'confirmed',createdAt:'2026-10-01'}]}};
 assert.equal(deepContextHash(enriched,1),deepContextHash(base));assert.notEqual(deepContextHash(enriched,2),deepContextHash(base));
 const body=buildDeepAnalysisRequest({...base,personal:{...base.personal,interests:[],preferences:'',confirmedMemories:[{...memory,confirmation:'confirmed'}]},topic:'career'});assert.match(body.input[0].content,/reportPlan/);assert.match(body.input[0].content,/career/);assert.match(body.instructions,/300-500/);
});
