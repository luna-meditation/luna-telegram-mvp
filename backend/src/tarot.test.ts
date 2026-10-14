import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
process.env.BOT_TOKEN='test-bot-token';process.env.BOT_USERNAME='test';process.env.MINI_APP_URL='https://example.com';process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.OPENAI_API_KEY='test-only';
const {tarotInputSchema,tarotRequestHash,tarotCatalog,buildTarotAiRequest}=await import('./tarot-policy.js');
const {generateTarot}=await import('./tarot.js');
const {emptyPersonalProfile}=await import('./personalization-policy.js');
const input=tarotInputSchema.parse({clientReadingId:'00000000-0000-4000-8000-000000000010',cardId:'the-fool',orientation:'reversed',intention:'growth',question:'What small step can I try?',language:'en',generate:true});
const interpretation={summary:'A small step is enough.',cardMeaning:'Notice impulsive starts.',context:'Experiment without committing too much.',reflection:'Choose one reversible action.',question:'What would make the step feel safe?',continuation:null};
test('Tarot validates all canonical 78 cards, orientation, owner spoofing and immutable request identity',()=>{
 assert.equal(tarotCatalog.length,78);for(const card of tarotCatalog)assert.equal(tarotInputSchema.parse({...input,cardId:card.id}).cardId,card.id);
 for(const value of [{...input,cardId:'invented'},{...input,telegram_id:123},{...input,orientation:'sideways'},{...input,question:'x'.repeat(241)}])assert.equal(tarotInputSchema.safeParse(value).success,false);
 assert.equal(tarotRequestHash(input),tarotRequestHash({...input,generate:false}));assert.notEqual(tarotRequestHash(input),tarotRequestHash({...input,orientation:'upright'}));
});
test('Tarot request excludes birth details and non-consented preferences; provider storage is off',()=>{
 const profile={...emptyPersonalProfile,interests:['tarot' as const],preferences:'short replies',birth_date:'1990-01-01',birth_time:'12:30',birth_place:'Private city'};
 const denied=JSON.stringify(buildTarotAiRequest(input,profile,'gpt-5-mini',1600));assert.doesNotMatch(denied,/short replies|1990-01-01|12:30|Private city/);
 const allowed=buildTarotAiRequest(input,{...profile,ai_context_consent:true},'gpt-5-mini',1600);assert.equal(allowed.store,false);assert.equal(allowed.max_output_tokens,1600);assert.match(JSON.stringify(allowed),/short replies/);assert.doesNotMatch(JSON.stringify(allowed),/1990-01-01|12:30|Private city/);
 assert.match(allowed.instructions,/not scientifically reliable prediction/);assert.equal(allowed.text.format.strict,true);
});
test('AI receives canonical orientation-specific meanings from the same bilingual deck as the UI',()=>{
 for(const card of tarotCatalog)for(const language of ['en','ru'] as const)for(const orientation of ['upright','reversed'] as const){
  const request=buildTarotAiRequest({...input,cardId:card.id,language,orientation},null,'gpt-5-mini',1600);
  const supplied=JSON.parse(request.input[0].content[0].text);
  assert.equal(supplied.card.meaning,card.meaning[language][orientation]);assert.ok(supplied.card.meaning.length>5);
 }
});
test('real provider adapter accepts structured complete response, not fixture templates',async()=>{
 let calls=0;const result=await generateTarot(input,null,async(_body,signal)=>{calls++;assert.equal(signal.aborted,false);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(interpretation)}]}]}));});
 assert.deepEqual(result,interpretation);assert.equal(calls,1);
});
test('provider 5xx, refusal, incomplete output, invalid JSON and timeout have no automatic paid retries',async()=>{
 for(const mock of [()=>new Response('{}',{status:503}),()=>new Response(JSON.stringify({status:'incomplete',output:[]})),()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]})),()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'bad-json'}]}]})),()=>{throw new DOMException('Timed out','TimeoutError');}]){
  let calls=0;await assert.rejects(generateTarot(input,null,async()=>{calls++;return mock();}));assert.equal(calls,1);
 }
});
test('all history queries enforce verified ownership and no Moon Seeds/payment writes exist',()=>{
 const source=readFileSync('src/tarot.ts','utf8');assert.equal((source.match(/\.eq\('telegram_id',telegramId\)/g)||[]).length,6);
 assert.doesNotMatch(source,/awardMoonSeeds|createStars|moon_seeds_available|\.from\('payments'\)/);
 assert.match(source,/safetyCategory\(input.question\)/);assert.match(source,/!safety/);
 const server=readFileSync('src/server.ts','utf8');assert.match(server,/app.use\('\/api\/tarot',rateLimit[^\n]*tarotRouter/);assert.match(readFileSync('src/tarot-router.ts','utf8'),/tarotRouter.use\(express.json\(\{limit:'16kb'\}\),requireTelegramWebApp/);
 const sql=readFileSync('../supabase/migrations/20261014041334_luna_tarot_ai_reading_history.sql','utf8');assert.match(sql,/security invoker set search_path=''/);assert.match(sql,/from public,anon,authenticated/);assert.doesNotMatch(sql,/alter table public\.(users|moon_gardens|payments|playback_sessions)/);
});
