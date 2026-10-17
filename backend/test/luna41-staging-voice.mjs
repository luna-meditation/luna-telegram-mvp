// One separately approved synthetic audio run, never a public voice endpoint.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite} from '../dist/luna32-staging-guard.js';
const runName='luna41-voice-fixtures-20261017-v1',approvedMicrousd=50000;
const texts={en:{inhale:'Inhale.',inhale_top:'Top up.',hold:'Hold.',exhale:'Exhale.',pause:'Rest.',sample:'Luna, please recommend a short meditation for focus.'},ru:{inhale:'Вдох.',inhale_top:'Довдох.',hold:'Задержка.',exhale:'Выдох.',pause:'Пауза.',sample:'Луна, подбери короткую медитацию для фокуса.'},mixed:{sample:'Луна, открой Moon Garden, а затем дыхательную практику.'}};
const tasks=Object.entries(texts).flatMap(([language,items])=>Object.entries(items).map(([id,text])=>({language,id,text})));
const check=async q=>{const r=await q;assert.ifError(r.error);return r.data;};
function wav(pcm){assert.ok(pcm.length>0&&pcm.length<30*48000&&pcm.length%2===0);const out=Buffer.alloc(44+pcm.length);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(24000,24);out.writeUInt32LE(48000,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(pcm.length,40);pcm.copy(out,44);return out;}
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const {netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const {supabase:db}=await import('../dist/db.js'),{env}=await import('../dist/config.js');assert.ok(env.STAGING_MODE&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 let stored=await check(db.from('luna30_qa_report_runs').select('state,result').eq('run_name',runName).maybeSingle());
 if(options.readOnly)return Response.json(stored??{state:'not_started',result:null},{headers:{'Cache-Control':'private, no-store'}});
 if(!stored){const r=await db.from('luna30_qa_report_runs').insert({run_name:runName,state:'paused',result:{status:'IN_PROGRESS',sourceCommit:options.sourceCommit,approvedMicrousd,spentMicrousd:0,heldMicrousd:0,providerCalls:0,clips:[],transcriptions:[],rawPersonalAudioStored:false,productionTouched:false}});if(r.error?.code==='23505')return new Response(null,{status:204});assert.ifError(r.error);stored={state:'paused'};}
 const claim='running:'+randomUUID(),claimed=await check(db.from('luna30_qa_report_runs').update({state:claim}).eq('run_name',runName).eq('state','paused').select('result').maybeSingle());if(!claimed)return new Response(null,{status:204});
 const result=claimed.result;let state='paused';const persist=()=>check(db.from('luna30_qa_report_runs').update({result}).eq('run_name',runName).eq('state',claim).select('run_name').single());
 try{
  assert.ok(!result.activeCall&&result.approvedMicrousd===approvedMicrousd&&result.sourceCommit===options.sourceCommit);if(result.status!=='IN_PROGRESS'){state='completed';return new Response(null,{status:204});}
  const key=Netlify.env.get('OPENAI_API_KEY');assert.ok(key);const auth={Authorization:`Bearer ${key}`};
  if(!result.availability){const r=await fetch('https://api.openai.com/v1/models',{headers:auth,signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const body=await r.json();result.availability=['tts-1','whisper-1'].map(model=>({model,available:body.data.some(v=>v.id===model)}));await persist();assert.ok(result.availability.every(v=>v.available));}
  // Fixed synthetic tasks only. No caller-supplied prompt, model, audio or URL.
  const pending=[...tasks.filter(t=>!result.clips.some(c=>c.language===t.language&&c.id===t.id)).map(t=>({...t,type:'speech'})),...Object.keys(texts).filter(language=>!result.transcriptions.some(t=>t.language===language)).map(language=>({type:'transcription',language,id:'sample'}))];
  for(const task of pending.slice(0,4)){
   const ceiling=task.type==='speech'?Buffer.byteLength(task.text,'utf8')*15:10000;
   assert.ok(result.providerCalls<16&&result.spentMicrousd+result.heldMicrousd+ceiling<=approvedMicrousd,'voice_budget_exhausted');
   result.providerCalls++;result.heldMicrousd+=ceiling;result.activeCall={type:task.type,language:task.language,id:task.id,ceiling};await persist();const start=Date.now();let response,cost=ceiling;
   if(task.type==='speech'){
    response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({model:'tts-1',voice:'nova',input:task.text,response_format:'pcm',speed:1.1}),signal:AbortSignal.timeout(40000)});assert.equal(response.status,200);
    const bytes=wav(Buffer.from(await response.arrayBuffer())),durationSeconds=(bytes.length-44)/48000;assert.ok(task.id==='sample'||durationSeconds<2,'cue_too_long_for_shortest_phase');
    result.clips.push({language:task.language,id:task.id,text:task.text,model:'tts-1',voice:'nova',format:'wav',sampleRate:24000,durationSeconds,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64'),latencyMs:Date.now()-start,costCeilingMicrousd:ceiling});
   }else{
    const clip=result.clips.find(c=>c.language===task.language&&c.id==='sample');assert.ok(clip);const form=new FormData();form.set('model','whisper-1');form.set('response_format','verbose_json');form.set('file',new Blob([Buffer.from(clip.base64,'base64')],{type:'audio/wav'}),'synthetic-'+task.language+'.wav');
    response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:auth,body:form,signal:AbortSignal.timeout(40000)});assert.equal(response.status,200);const body=await response.json();assert.ok(typeof body.text==='string'&&body.text.length>5&&Number.isFinite(body.duration)&&body.duration<=30);cost=Math.ceil(Math.max(1,body.duration))*100;
    result.transcriptions.push({language:task.language,detectedLanguage:body.language,text:body.text,durationSeconds:body.duration,model:'whisper-1',latencyMs:Date.now()-start,costEstimateMicrousd:cost});
   }
   result.heldMicrousd-=ceiling;result.spentMicrousd+=cost;delete result.activeCall;await persist();
  }
  if(result.clips.length===13&&result.transcriptions.length===3){result.status='AUDIO_COLLECTED_AWAITING_REVIEW';state='completed';}
 }catch{result.status='STOPPED_SAFELY';state='blocked';}
 finally{await check(db.from('luna30_qa_report_runs').update({state,result}).eq('run_name',runName).eq('state',claim));}
 return new Response(null,{status:204});
}
