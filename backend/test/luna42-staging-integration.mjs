// Real staging CMS + normal Telegram-authenticated voice/chat routes. No LLM
// generation: the global guard MUST stay closed. Only two fixed STT samples.
import assert from 'node:assert/strict';import {createHmac,randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
import {protectedStateFingerprint} from './luna31-financial-guard.mjs';
const runName='luna42-voice-http-20261018-v3',qaOwner=158467796;
const must=async q=>{const r=await q;assert.ifError(r.error);return r.data;};
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js'),host='https://luna-staging-itfl.netlify.app',ctx={site:{id:luna32StagingSite},ip:'127.0.0.1'};await netlifyStagingHandler(new Request(host+'/health'),ctx);
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.STAGING_VOICE_QA_GRANT_ID===options.grantId&&env.STAGING_TELEGRAM_IDS===String(qaOwner));
 const stored=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers:{'Cache-Control':'private, no-store'}});
 if(stored)return new Response(null,{status:204});
 const prior=await must(db.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna42-voice-http-20261018-v2').single());assert.equal(prior.state,'failed');assert.equal(prior.result.providerCalls,0);assert.equal(prior.result.spentMicrousd,0);assert.equal(prior.result.heldMicrousd,0);
 const result={status:'RUNNING',sourceCommit:options.sourceCommit,grantId:options.grantId,qaOwner,expiresAt:options.expiresAt,providerCalls:0,spentMicrousd:0,heldMicrousd:0,requestIds:[],checks:[],cms:[],voice:[],productionTouched:false,paymentOrSeedsChanged:false};
 const claim=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result});if(claim.error?.code==='23505')return new Response(null,{status:204});assert.ifError(claim.error);
 const state=async()=>(await must(db.from('luna30_qa_report_runs').select('result').eq('run_name',runName).single())).result;
 const save=async patch=>must(db.from('luna30_qa_report_runs').update({result:{...await state(),...patch}}).eq('run_name',runName));
 const fingerprint=async()=>protectedStateFingerprint(await must(db.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',qaOwner).single()),await must(db.from('moon_gardens').select('*').eq('telegram_id',qaOwner)));
 const before=await fingerprint();let final='failed';const conversations=[];
 const signed=(owner,language='en')=>{const d=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:owner,first_name:'Luna QA',language_code:language})}),text=[...d].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),key=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();d.set('hash',createHmac('sha256',key).update(text).digest('hex'));return d.toString();};
 const api=async(path,body,language='en',owner=qaOwner)=>{const r=await netlifyStagingHandler(new Request(host+path,{method:body===undefined?'GET':'POST',headers:{'x-telegram-init-data':signed(owner,language),...(body instanceof Buffer?{'Content-Type':'audio/wav'}:body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:body instanceof Buffer?body:JSON.stringify(body)}:{})}),ctx);let data;try{data=await r.json();}catch{data={};}return{status:r.status,data};};
 try{
  const settings=await must(db.from('luna32_runtime_settings').select('generation_enabled').eq('id',true).single());assert.equal(settings.generation_enabled,false);
  const {editorialBaseline}=await import('../dist/luna42-editorial.js');
  for(const kind of ['breathwork','tarot','astrology','garden','achievement','share','bot']){
   const base=editorialBaseline.find(e=>e.kind===kind),key=base.key,priorPublished=(await must(db.from('luna42_published_editorial').select('body').eq('kind',kind).eq('content_key',key).maybeSingle()))?.body;
   const latest=async()=>((await must(db.from('luna40_content_versions').select('version').eq('kind',kind).eq('content_key',key).order('version',{ascending:false}).limit(1)))[0]?.version??0);
   const priorDraft=(await must(db.from('luna40_content_versions').select('state,body').eq('kind',kind).eq('content_key',key).order('version',{ascending:false}).limit(1)))[0];
   const body={...base.body,title:{en:'QA '+base.body.title.en,ru:'QA '+base.body.title.ru}},publish=async(state,payload)=>{const input={requestId:randomUUID(),kind,key,expectedVersion:await latest(),state,body:payload,reason:'Synthetic Luna 4.2 CMS QA',confirmed:true},r=await api('/api/admin/v4/content',input);assert.equal(r.status,200,`cms_${kind}_${state}_failed_${r.data.code??'unknown'}`);return{input,r};};
   try{
    const draft=await publish('draft',body),replay=await api('/api/admin/v4/content',draft.input);assert.deepEqual(replay.data,draft.r.data);
    assert.deepEqual((await must(db.from('luna42_published_editorial').select('body').eq('kind',kind).eq('content_key',key).maybeSingle()))?.body,priorPublished);
    await publish('published',body);const publicResult=await api('/api/content/editorial');assert.equal(publicResult.status,200);assert.deepEqual(publicResult.data.entries.find(e=>e.kind===kind&&e.key===key).body,body);
    const conflict=await api('/api/admin/v4/content',{...draft.input,requestId:randomUUID()});assert.equal(conflict.status,409,`cms_conflict_${kind}_${conflict.data.code??'unknown'}`);
    const invalid=await api('/api/admin/v4/content',{...draft.input,requestId:randomUUID(),expectedVersion:await latest(),body:{...body,price:1}});assert.ok([400,422].includes(invalid.status));
    result.cms.push({kind,status:'PASS',savePublishReadReopenReplay:true,staleAndFinancialFieldsRejected:true});
   }finally{
    await publish('archived',base.body);if(priorPublished)await publish('published',priorPublished);if(priorDraft?.state==='draft'&&priorDraft.body.title)await publish('draft',priorDraft.body);
    assert.deepEqual((await must(db.from('luna42_published_editorial').select('body').eq('kind',kind).eq('content_key',key).maybeSingle()))?.body,priorPublished);
   }
   await save({cms:result.cms});
  }
  assert.equal((await api('/api/admin/v4/content?kind=tarot',undefined,'en',420042100)).status,403);
  result.checks.push({name:'Seven real CMS HTTP adapters publish and reopen validated content; restore exact prior publication; private RBAC',status:'PASS'});await save({checks:result.checks});
  const attemptsBefore=(await must(db.from('luna32_ai_attempts').select('id').eq('telegram_id',qaOwner))).length;
  let activeConversation;
  for(const sample of options.samples){
   const wav=Buffer.from(sample.base64,'base64'),path=`/api/luna/voice/${sample.requestId}?language=${sample.language}`;
   const noAuth=await netlifyStagingHandler(new Request(host+path,{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav}),ctx);assert.equal(noAuth.status,401);
   const transcript=await api(path,wav,sample.language);assert.equal(transcript.status,200,'voice_http_transcription_failed');assert.equal(transcript.data.cached,false);assert.ok(/focus|фокус/i.test(transcript.data.text),'voice_transcript_quality_failed');
   const cached=await api(path,wav,sample.language);assert.equal(cached.status,200);assert.equal(cached.data.cached,true);assert.equal(cached.data.text,transcript.data.text);
   const input={requestId:randomUUID(),language:sample.language,message:transcript.data.text,...(activeConversation?{conversationId:activeConversation}:{})},chat=await api('/api/luna/chat',input,sample.language);assert.equal(chat.status,200,'voice_to_normal_chat_failed');assert.ok(chat.data.message.metadata.recommendedMeditationId,'voice_to_verified_card_failed');
   const conversationId=chat.data.conversationId;assert.ok(conversationId);if(!activeConversation){conversations.push(conversationId);activeConversation=conversationId;}else assert.equal(conversationId,activeConversation);
   const replay=await api('/api/luna/chat',input,sample.language);assert.equal(replay.data.message.id,chat.data.message.id);
   const reopened=await api('/api/luna/conversations/'+conversationId,undefined,sample.language);assert.equal(reopened.status,200);assert.ok(JSON.stringify(reopened.data).includes(chat.data.message.id));
   result.voice.push({language:sample.language,status:'PASS',cachedTranscript:true,reviewThenExplicitSend:true,conversationReopened:true,duplicateGeneration:0,costMicrousd:transcript.data.costMicrousd});await save({voice:result.voice});
  }
  assert.equal((await must(db.from('luna32_ai_attempts').select('id').eq('telegram_id',qaOwner))).length,attemptsBefore);const current=await state();assert.equal(current.providerCalls,2);assert.equal(current.heldMicrousd,0);assert.ok(current.spentMicrousd+402<=30000);assert.equal(await fingerprint(),before);
  assert.equal((await must(db.from('luna32_runtime_settings').select('generation_enabled').eq('id',true).single())).generation_enabled,false);
  result.checks.push({name:'Normal signed voice API RU/EN, cached transcript, explicit same-chat send/reopen/replay, no LLM or wallet change',status:'PASS'});final='completed';await save({status:'PASS',checks:result.checks});
 }catch(error){await save({status:'FAIL',failure:String(error.message).slice(0,180),cms:result.cms,voice:result.voice});}
 finally{
  // Only conversations created by this exact synthetic QA worker are removed.
  for(const id of conversations)await must(db.from('ai_conversations').delete().eq('telegram_id',qaOwner).eq('id',id));
  if(await fingerprint()!==before){final='failed';await save({status:'FAIL',protectionFailure:true});}
  await must(db.from('luna30_qa_report_runs').update({state:final}).eq('run_name',runName));
 }
 return new Response(null,{status:204});
}
