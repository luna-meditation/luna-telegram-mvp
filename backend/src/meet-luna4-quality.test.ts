import test from 'node:test';import assert from 'node:assert/strict';
import {assertSubstantiveAstrologyAnswer,answeredArtifactTurns} from './luna-intelligence-grounding.js';
import {usesIntelligencePrompt,buildIntelligenceInstructions} from './luna-intelligence-prompt.js';
import {answerFromAttachedEvidence} from './luna-intelligence-turn.js';
import {runLunaToolTurn} from './luna32-tools.js';
import {readFileSync} from 'node:fs';
const first={subject:{label:'Synthetic A',kind:'self'},placements:{mercury:'Capricorn'},ascendant:null,aspects:[]};
const pair={first,second:{...first,subject:{label:'Synthetic B',kind:'other'}},synastry:{aspects:[]}};
test('failed numerology requests stay in storage but cannot override a newly selected compatibility question',()=>{
 const rows=[{role:'user',request_id:'answered',content:'Old valid question'},{role:'assistant',request_id:'answered',content:'Old valid answer'},{role:'user',request_id:'failed',content:'Unanswered old numerology'},{role:'user',request_id:'current',content:'How can these selected charts communicate?'}];assert.deepEqual(answeredArtifactTurns(rows).map(m=>m.request_id),['answered','answered','current']);assert.equal(rows.length,4);assert.equal(answeredArtifactTurns(rows).at(-1)?.content,rows[3].content);
});
test('a selected calculated explanation cannot drift into an unrelated numerology tool; live lookups remain available',async()=>{
 for(const request of ['Как нам выстроить деловое общение?','Explain Mercury in this exact chart.'])assert.equal(answerFromAttachedEvidence(true,request),true);
 for(const request of ['Explain current transits','Найди прошлый разговор','Open my journal','Каковы транзиты сегодня?'])assert.equal(answerFromAttachedEvidence(true,request),false);assert.equal(answerFromAttachedEvidence(false,'Explain my Life Path'),false);
 let calls=0;await runLunaToolTurn({input:[{role:'user',content:'Explain this exact chart'}]},{definitions:[],numerologyContext:()=>null} as never,async request=>{calls++;assert.equal(request.tool_choice,'none');return{status:'completed',output:[]};},{maxToolRounds:2,answerFromSelectedEvidence:true});assert.equal(calls,1);
});
test('the actual chat entry point selects Meet Luna policy instead of silently falling back to legacy instructions',()=>{
 for(const version of ['intelligence-v1','intelligence-v3','meet-luna4'])assert.equal(usesIntelligencePrompt(version),true);assert.equal(usesIntelligencePrompt('luna43'),false);
 const pipeline=readFileSync(new URL('./luna-ai.ts',import.meta.url),'utf8');assert.match(pipeline,/intelligence:intelligence&&usesIntelligencePrompt\(env.AI_PROMPT_VERSION\)/);assert.doesNotMatch(pipeline,/\['intelligence-v1','intelligence-v3'\]\.includes/);
 assert.match(buildIntelligenceInstructions({version:4,language:'ru',catalog:[],context:{},address:''}),/MEET_LUNA_PERSONAL_COMPANION_4/);
 assert.match(pipeline,/THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_/);assert.match(pipeline,/SELECTED_CALCULATED_EVIDENCE=/);assert.match(pipeline,/JSON\.stringify\(selectedAstrology\)/);
 assert.match(pipeline,/if\(\(recentMessages.at\(-1\)\?\.role!=='user'/);
});
test('a selected calculated compatibility report requires an actual interpretation, not another permission loop',()=>{
 for(const [text,request]of [['Я объясню каждую карту и дам предложение. Готов продолжать?','Как нам лучше выстроить деловое общение?'],['I can explain both charts. Shall I continue?','How can we communicate better?']])assert.throws(()=>assertSubstantiveAstrologyAnswer(text,pair,request),/incomplete_calculated_interpretation/);
 assert.doesNotThrow(()=>assertSubstantiveAstrologyAnswer('Меркурий в квадрате к Сатурну — символическая тема для обсуждения ожиданий, не факт о личности.',pair,'Как нам общаться?'));
 assert.doesNotThrow(()=>assertSubstantiveAstrologyAnswer('Mercury in Capricorn can be a symbolic prompt for a written outline.',{first},'Explain Mercury.'));
});
test('noninterpretative acknowledgements and questions about symbolic limits do not require invented chart claims',()=>{
 for(const request of ['Thanks','Спасибо','Why is astrology not scientific?','Объясни ограничения астрологии'])assert.doesNotThrow(()=>assertSubstantiveAstrologyAnswer('These are symbols, not evidence of personality.',pair,request));
});
