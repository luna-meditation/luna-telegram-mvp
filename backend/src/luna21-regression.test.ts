import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
process.env.BOT_TOKEN='test-only';process.env.BOT_USERNAME='test';process.env.MINI_APP_URL='https://example.com';process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.OPENAI_API_KEY='test-only';
const {spreadInputSchema,spreadRequestHash,buildSpreadAiRequest}=await import('./tarot-spread-policy.js');
const {generateTarotSpread}=await import('./tarot-spreads.js');
const {emptyPersonalProfile}=await import('./personalization-policy.js');
const {qaCacheMatches,qaUsedBudget}=await import('./luna21-qa.js');
const cards=['the-fool','the-star','the-moon','the-sun','the-world'].map((cardId,index)=>({cardId,orientation:index%2?'reversed':'upright'}));
const input=spreadInputSchema.parse({clientReadingId:'00000000-0000-4000-8000-000000000021',kind:'three',cards:cards.slice(0,3),intention:'growth',question:'What small next step can I try?',language:'en',generate:true});
const reflection={summary:'Synthetic test',cardMeaning:'Pattern',context:'Context',reflection:'Practice',question:'A question?',continuation:null,cardInsights:input.cards.map(c=>({cardId:c.cardId,text:'Position specific'})),links:'A connected reflection'};
test('QA semantic cache ignores JSONB key order; resume carries consumed calls and rejects unknown costs',()=>{
 assert.equal(qaCacheMatches({summary:'A',context:{a:1,b:2}},{context:{b:2,a:1},summary:'A'}),true);
 assert.equal(qaCacheMatches({summary:'A'},{summary:'B'}),false);
 assert.deepEqual(qaUsedBudget([{estimated_cost:'0.000550',request_status:'success',model:'gpt-5-mini-2025-08-07'}]),{spent:.00055,calls:1});
 assert.throws(()=>qaUsedBudget([{estimated_cost:null,request_status:'success',model:'gpt-5-mini'}]));
 assert.throws(()=>qaUsedBudget([{estimated_cost:.04,request_status:'success',model:'gpt-5-mini'}]));
});
test('3/5-card inputs reject duplicates, wrong sizes, forged owner, invalid orientation and overlong questions',()=>{
 for(const v of [{...input,cards:cards.slice(0,2)},{...input,cards:[cards[0],cards[0],cards[2]]},{...input,kind:'five'},{...input,telegramId:158467796},{...input,cards:[...cards.slice(0,2),{cardId:'invented',orientation:'upright'}]},{...input,question:'x'.repeat(241)}])assert.equal(spreadInputSchema.safeParse(v).success,false);
 assert.equal(spreadInputSchema.parse({...input,kind:'five',cards}).cards.length,5);
 assert.equal(spreadRequestHash(input),spreadRequestHash({...input,generate:false}));assert.notEqual(spreadRequestHash(input),spreadRequestHash({...input,cards:[...input.cards].reverse()}));
});
test('AI gets actual positions and orientation meanings, bounded output and no birth/nonconsented data',()=>{
 for(const kind of ['three','five'] as const)for(const language of ['en','ru'] as const){
  const value=spreadInputSchema.parse({...input,kind,language,cards:cards.slice(0,kind==='three'?3:5)});
  const request=buildSpreadAiRequest(value,{...emptyPersonalProfile,preferences:'PRIVATE',birth_date:'1980-01-01',birth_place:'PRIVATE PLACE'},'gpt-5-mini');
  assert.equal(request.store,false);assert.equal(request.max_output_tokens,kind==='three'?2400:3600);assert.equal(request.text.format.strict,true);
  assert.match(request.instructions,kind==='three'?/350–550/:/550–800/);assert.match(request.instructions,/not disconnected/);assert.doesNotMatch(JSON.stringify(request),/PRIVATE|1980-01-01/);
  const data=JSON.parse(request.input[0].content[0].text);assert.equal(data.cards.length,value.cards.length);assert.equal(data.cards[1].orientation,'reversed');assert.ok(data.cards.every((c:{position:string})=>c.position));
 }
});
test('spread adapter meters real response usage before validation and never silently replaces wrong cards',async()=>{
 let calls=0,meters=0;const transport=async()=>{calls++;return new Response(JSON.stringify({status:'completed',model:'gpt-5-mini-2025-08-07',service_tier:'default',usage:{input_tokens:500,output_tokens:300},output:[{content:[{type:'output_text',text:JSON.stringify(reflection)}]}]}));};
 assert.deepEqual(await generateTarotSpread(input,null,transport,async()=>{meters++;}),reflection);assert.equal(calls,1);assert.equal(meters,1);
 await assert.rejects(generateTarotSpread(input,null,async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...reflection,cardInsights:[{cardId:'the-world',text:'Wrong card'}]})}]}]}))));
});
test('AI errors/refusals/timeouts have no automatic retry or charge',async()=>{
 for(const transport of [async()=>new Response('{}',{status:503}),async()=>new Response(JSON.stringify({status:'incomplete',output:[]})),async()=>{throw new DOMException('Timeout','TimeoutError');}]){let calls=0;await assert.rejects(generateTarotSpread(input,null,async()=>{calls++;return transport();}));assert.equal(calls,1);}
});
test('every new economy/monetization and maintenance switch defaults OFF; no monthly Stars price is invented',()=>{
 const config=readFileSync('src/config.ts','utf8');for(const key of ['FEATURE_DAILY_CARD_V2','FEATURE_ECONOMY_REWARDS_V2','FEATURE_TAROT_PAID_READINGS','FEATURE_PREMIUM_V2','FEATURE_PAYMENT_ATOMIC','LUNA21_QA_ENABLED'])assert.match(config,new RegExp(`${key}: envBoolean.default\\(false\\)`));
 const economy=readFileSync('../supabase/migrations/20261014141847_luna21_economy_foundation.sql','utf8');assert.match(economy,/monthly_premium_stars integer check/);assert.match(economy,/seed_packages jsonb not null default '\[\]'/);assert.doesNotMatch(economy,/update public\.users|update public\.payments/);
 const qa=readFileSync('src/luna21-qa.ts','utf8');assert.match(qa,/calls>=3/);assert.match(qa,/spent\+maximumCost>\.03/);assert.match(qa,/Durable one-off grant marker/);assert.match(qa,/!user\|\|!run/);assert.match(qa,/service_tier:'default'/);
});
