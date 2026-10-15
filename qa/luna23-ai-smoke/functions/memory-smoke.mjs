// QA-only draft deployment. Never part of the Luna production function directory.
import {getStore} from '@netlify/blobs';
import {selectRelevantMemories} from '../../../backend/dist/personal-memory-policy.js';
import {confirmedMemoryPrompt} from '../../../backend/dist/luna/prompts/memory-policy.js';
import {createLunaResponseTransport,responseOutputText} from '../../../backend/dist/luna/response-transport.js';
const requestLunaResponse=createLunaResponseTransport(()=>Netlify.env.get('OPENAI_API_KEY'));

const siteId='a634a7fc-1ecb-47fa-8b43-edd81a7e3694';
const store=()=>getStore({name:'luna23-qa-smoke-20261015',consistency:'strong'});
const permitted=()=>Netlify.env.get('STAGING_MODE')==='true'&&Netlify.env.get('SUPABASE_URL')==='https://funvzpmpbgazsisehiru.supabase.co';
const fixture={id:'synthetic',category:'preferences',memory_key:'practice',memory_value:'I prefer three-minute evening meditations.',confirmation_status:'confirmed',memory_kind:'fact',is_sensitive:false,source_type:'user_entered',source_message_id:null,revision:1,created_at:'2026-10-15T00:00:00Z',updated_at:'2026-10-15T00:00:00Z',confirmed_at:'2026-10-15T00:00:00Z'};

async function runSmoke(event){
  if(event.site.id!==siteId||!permitted())return;
  const cache=store();
  // Immutable cache claim, not a counter. Fail closed: retries cannot spend again.
  const claim=await cache.setJSON('reservation',{maxCalls:2,maxUsd:0.02,deploy:event.deploy.id},{onlyIfNew:true});
  if(!claim.modified)return;
  const result={status:'running',model:'gpt-5-mini',calls:[],productionWrites:0,supabaseWrites:0,fixtureOnly:true};
  await cache.setJSON('result',result);
  try{
   for(const language of ['en','ru']){
    const query=language==='en'?'Recommend a small meditation habit for this evening.':'Предложи короткую практику медитации на вечер.';
    const selected=selectRelevantMemories([fixture,{...fixture,id:'pending',confirmation_status:'pending',memory_value:'Invented private inference'}],query);
    if(selected.length!==1)throw new Error('retrieval_failed');
    const body={model:'gpt-5-mini',store:false,reasoning:{effort:'minimal'},max_output_tokens:700,
     instructions:confirmedMemoryPrompt+' Respond in '+(language==='en'?'English':'Russian')+'. This is a neutral synthetic QA fixture. Answer naturally in 2 sentences, using the permitted practice preference. Never claim to save data.',
     input:[{role:'user',content:'USER_CONTEXT '+JSON.stringify({personalContext:{confirmedMemories:selected}})+'\n'+query}]};
    if(Buffer.byteLength(JSON.stringify(body),'utf8')>8000)throw new Error('budget_guard');
    const response=await requestLunaResponse(body,AbortSignal.timeout(45000));
    const data=await response.json();const text=responseOutputText(data);
    const input=data.usage?.input_tokens??0,output=data.usage?.output_tokens??0,cached=data.usage?.input_tokens_details?.cached_tokens??0;
    const cost=((input-cached)*0.25+cached*0.025+output*2)/1000000;
    result.calls.push({language,httpStatus:response.status,status:data.status??'error',inputTokens:input,cachedTokens:cached,outputTokens:output,costUsd:cost,text:text??null,errorCode:data.error?.code??null,selectedMemoryCount:selected.length});
    await cache.setJSON('result',result);
    if(!response.ok||!text)throw new Error('provider_failed');
   }
   const reopened=await cache.get('result',{type:'json',consistency:'strong'});
   result.persistedReopenVerified=JSON.stringify(reopened.calls)===JSON.stringify(result.calls);
   result.totalCostUsd=result.calls.reduce((sum,call)=>sum+call.costUsd,0);
   result.status=result.persistedReopenVerified&&result.totalCostUsd<=0.02?'PASS':'FAIL';
  }catch(error){result.status='FAIL';result.error=error instanceof Error?error.message:'test_failed';}
  await cache.setJSON('result',result);
}
export default {
 deploySucceeded:runSmoke,
 async fetch(request,context){
  if(context.site.id!==siteId||!permitted())return new Response('Denied',{status:403});
  if(request.method==='POST'){
   if(request.headers.get('origin')!==new URL(request.url).origin||await request.text()!=='run=approved')return new Response('Denied',{status:403});
   await runSmoke({site:context.site,deploy:context.deploy});
  }else if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const result=await store().get('result',{type:'json',consistency:'strong'});
  return Response.json(result??{status:'pending'},{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
 }
};
