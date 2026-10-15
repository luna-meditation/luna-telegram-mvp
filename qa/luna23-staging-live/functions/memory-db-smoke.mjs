// Private, staging-only component integration test. NOT a Telegram login substitute.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {netlifyStagingHandler} from '../../../backend/dist/netlify-staging-handler.js';

const siteId='a634a7fc-1ecb-47fa-8b43-edd81a7e3694';
const qaOwner=158467796;
const cache=()=>getStore({name:'luna23-staging-memory-20261015',consistency:'strong'});
async function run(context){
 if(context.site?.id!==siteId||Netlify.env.get('STAGING_MODE')!=='true'||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return;
 const store=cache();
 // An immutable one-run claim, not a balance/counter. A failed run cannot spend again.
 const claim=await store.setJSON('reservation',{maxCalls:2,maxUsd:0.02,deploy:context.deploy?.id},{onlyIfNew:true});
 if(!claim.modified)return;
 const result={status:'running',realStagingDatabase:true,realTelegramLoginVerified:false,productionWrites:0,checks:[],calls:[],readings:[]};
 await store.setJSON('result',result);
 const check=(name,condition)=>{assert.ok(condition,name);result.checks.push({name,status:'PASS'});};
 const originalFetch=globalThis.fetch;
 let attempted=0;
 const created=[];
 try{
  const health=await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),context);
  check('pinned isolated staging runtime starts',health.status===200);
  const {supabase}=await import('../../../backend/dist/db.js');
  const memory=await import('../../../backend/dist/personal-memory.js');
  const {savePersonalProfile}=await import('../../../backend/dist/personalization.js');
  const {getUniverse,writePersonalMemory,listPersonalMemories,removePersonalMemory,getAiPersonalProfile}=memory;
  const {saveTarotReading,getTarotReading}=await import('../../../backend/dist/tarot.js');
  const {configureQaBotMenu}=await import('../../../backend/dist/staging-bot.js');
  const {env}=await import('../../../backend/dist/config.js');
  const {buildLunaOpenAiRequest}=await import('../../../backend/dist/luna-ai.js');
  const {permittedPersonalContext}=await import('../../../backend/dist/personalization-policy.js');
  const {stagingAiMeterRecord}=await import('../../../backend/dist/staging-ai-meter.js');
  check('production and monetization features excluded',!env.FEATURE_DAILY_CARD_V2&&!env.FEATURE_TAROT_SPREADS&&!env.FEATURE_ECONOMY_REWARDS_V2&&!env.FEATURE_TAROT_PAID_READINGS&&!env.FEATURE_PREMIUM_V2&&!env.FEATURE_PAYMENT_ATOMIC&&!env.FEATURE_MOON_SEEDS_PURCHASES);
  const before=await getUniverse(qaOwner);
  check('QA owner exists and no personal profile is overwritten',Boolean(before.identity)&&before.memories.length===0&&before.profile.display_name===null&&!before.contextConsent&&before.memoryEnabled);
  const profile={display_name:'Luna QA',interests:['tarot'],preferences:'',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:true};
  await savePersonalProfile(qaOwner,profile);
  let item=await writePersonalMemory(qaOwner,{category:'preferences',key:'qa_evening_practice',value:'I prefer a quiet evening practice.',confirmed:false});created.push(item.id);
  check('draft is saved in real Supabase but excluded from AI',item.confirmation_status==='pending'&&(await getAiPersonalProfile(qaOwner,'practice')).confirmed_memories.length===0);
  item=await writePersonalMemory(qaOwner,{category:'preferences',key:item.memory_key,value:item.memory_value,confirmed:true,revision:item.revision},item.id);
  check('confirmation persists on reopen',(await getUniverse(qaOwner)).memories.find(row=>row.id===item.id)?.confirmation_status==='confirmed');
  item=await writePersonalMemory(qaOwner,{category:'preferences',key:item.memory_key,value:'I prefer a quiet three-minute evening practice.',confirmed:true,revision:item.revision},item.id);
  check('editing persists with incremented revision',item.revision===3&&(await listPersonalMemories(qaOwner))[0].memory_value===item.memory_value);
  for(const [name,operation,expected] of [
   ['duplicate topic rejected',()=>writePersonalMemory(qaOwner,{category:'preferences',key:item.memory_key,value:'Different neutral value',confirmed:true}),409],
   ['stale edits rejected',()=>writePersonalMemory(qaOwner,{category:'preferences',key:item.memory_key,value:'Stale neutral value',confirmed:true,revision:1},item.id),409],
   ['cross-owner edit rejected',()=>writePersonalMemory(-23001,{category:'preferences',key:'qa_other',value:'Foreign edit',confirmed:true,revision:item.revision},item.id),409]
  ]){let code;try{await operation();}catch(error){code=error.status;}check(name,code===expected);}
  check('other owner sees no QA memory',(await listPersonalMemories(-23001)).length===0);
  await removePersonalMemory(-23001,item.id);
  check('cross-owner deletion cannot remove QA memory',(await listPersonalMemories(qaOwner)).some(row=>row.id===item.id));
  const pending=await writePersonalMemory(qaOwner,{category:'preferences',key:'qa_pending',value:'PENDING_DRAGON_FRUIT',confirmed:false});created.push(pending.id);
  const removed=await writePersonalMemory(qaOwner,{category:'preferences',key:'qa_removed',value:'DELETED_SUNFLOWER',confirmed:true});created.push(removed.id);
  await removePersonalMemory(qaOwner,removed.id);
  const sensitive=await writePersonalMemory(qaOwner,{category:'preferences',key:'qa_private',value:'PRIVATE_PINEAPPLE',confirmed:true,sensitiveConsent:true});created.push(sensitive.id);
  const selected=await getAiPersonalProfile(qaOwner,'practice');
  check('only relevant confirmed non-sensitive memory is retrieved',selected.confirmed_memories.length===1&&selected.confirmed_memories[0].value===item.memory_value);
  check('deleted memory is absent on reopen',!(await listPersonalMemories(qaOwner)).some(row=>row.id===removed.id));
  await savePersonalProfile(qaOwner,{...profile,ai_context_consent:false});
  check('withdrawn consent removes AI memory',(await getAiPersonalProfile(qaOwner,'practice')).confirmed_memories===undefined);
  await savePersonalProfile(qaOwner,profile);
  const chat=buildLunaOpenAiRequest({language:'en',catalog:[],context:{personalContext:permittedPersonalContext(await getAiPersonalProfile(qaOwner,'practice'))},recent:[{role:'user',content:'Reflect on an evening practice.'}]});
  check('the real chat request builder includes confirmed memory and preferred address',chat.instructions.includes(item.memory_value)&&chat.instructions.includes('Luna QA')&&!chat.instructions.includes('PENDING_DRAGON_FRUIT')&&!chat.instructions.includes('DELETED_SUNFLOWER')&&!chat.instructions.includes('PRIVATE_PINEAPPLE'));
  check('QA bot menu configured without messages or webhook',await configureQaBotMenu(env));
  globalThis.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(url==='https://api.openai.com/v1/responses'){
    const body=JSON.parse(String(init?.body));
    check('AI budget and model guard',attempted<2&&body.model==='gpt-5-mini'&&body.max_output_tokens<=1024&&Buffer.byteLength(JSON.stringify(body),'utf8')<=16000);
    const personal=JSON.parse(body.input[0].content[0].text).personalContext;
    check('actual outbound AI context is confirmed, relevant and owner-scoped',personal.displayName==='Luna QA'&&personal.confirmedMemories.length===1&&personal.confirmedMemories[0].value===item.memory_value&&!JSON.stringify(body).includes('PENDING_DRAGON_FRUIT')&&!JSON.stringify(body).includes('DELETED_SUNFLOWER')&&!JSON.stringify(body).includes('PRIVATE_PINEAPPLE'));
    attempted++;
    body.service_tier='default';
    const response=await originalFetch(input,{...init,body:JSON.stringify(body)});
    const data=await response.clone().json();
    const meter=stagingAiMeterRecord(data);
    result.calls.push({httpStatus:response.status,...meter,selectedMemoryCount:personal.confirmedMemories.length});
    await store.setJSON('result',result);
    return response;
   }
   return originalFetch(input,init);
  };
  for(const [language,orientation] of [['en','upright'],['ru','reversed']]){
   const body={clientReadingId:randomUUID(),cardId:'the-star',orientation,intention:'growth',question:language==='en'?'How could I approach an evening practice that suits my preferences?':'Как подойти к вечерней практике с учётом моих предпочтений?',language,generate:true};
   const saved=await saveTarotReading(qaOwner,body);
   check(`${language}: AI interpretation saved in Supabase`,saved.reading.status==='ready'&&Boolean(saved.reading.interpretation?.summary));
   const reopened=await getTarotReading(qaOwner,saved.reading.id);
   check(`${language}: reopening returns identical stored output`,JSON.stringify(reopened.interpretation)===JSON.stringify(saved.reading.interpretation));
   const callsBefore=attempted;
   const duplicate=await saveTarotReading(qaOwner,body);
   check(`${language}: duplicate request neither regenerates nor changes output`,attempted===callsBefore&&duplicate.reading.id===saved.reading.id&&JSON.stringify(duplicate.reading.interpretation)===JSON.stringify(reopened.interpretation));
   let denied=false;try{await getTarotReading(-23001,saved.reading.id);}catch(error){denied=error.status===404;}
   check(`${language}: other owner cannot reopen reading`,denied);
   result.readings.push({id:saved.reading.id,clientReadingId:body.clientReadingId,language,orientation,status:saved.reading.status});
   await store.setJSON('result',result);
  }
  check('exactly two paid provider calls made',attempted===2&&result.calls.length===2);
  result.totalCostUsd=result.calls.reduce((sum,call)=>sum+(call.estimated_cost??0),0);
  check('provider token usage is priced and below approved budget',result.calls.every(call=>call.estimated_cost!==null&&call.request_status==='success')&&result.totalCostUsd<=0.02);
  for(const id of created.filter(id=>id!==item.id))await removePersonalMemory(qaOwner,id);
  result.retainedQaMemoryId=item.id;
  check('temporary private and pending QA notes removed',(await listPersonalMemories(qaOwner)).length===1);
  const meter=await supabase.from('ai_usage').select('request_id,estimated_cost').eq('telegram_id',qaOwner).in('request_id',result.readings.map(reading=>'tarot:'+reading.clientReadingId));
  check('canonical AI usage persisted exactly once per reading',!meter.error&&meter.data.length===2);
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure=error?.code??error?.message??'test_failed';}
 finally{globalThis.fetch=originalFetch;await store.setJSON('result',result);}
}
export default {
 deploySucceeded:run,
 async fetch(request,context){
  if(context.site?.id!==siteId||Netlify.env.get('STAGING_MODE')!=='true')return new Response('Denied',{status:403});
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  return Response.json(await cache().get('result',{type:'json',consistency:'strong'})??{status:'pending'},{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
 }
};
