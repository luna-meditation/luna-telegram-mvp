// Explicit deploy-event QA only; NEVER copy into production functions.
// Additional owner-approved two synthetic requests, at most $0.01.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {netlifyStagingHandler} from '../dist/netlify-staging-handler.js';
export async function run(event){
 if(event.site?.id!=='a634a7fc-1ecb-47fa-8b43-edd81a7e3694'||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co'||Date.now()>Date.parse('2026-10-16T12:00:00Z'))return;
 await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:event.site,ip:'127.0.0.1'});
 const {env}=await import('../dist/config.js'),{supabase}=await import('../dist/db.js');
 assert.ok(env.STAGING_MODE&&env.STAGING_TELEGRAM_IDS==='158467796'&&env.STAGING_SUPABASE_PROJECT_REF==='funvzpmpbgazsisehiru');
 const runName='luna30-astrology-20261016-v2';const claim=await supabase.from('luna30_qa_report_runs').insert({run_name:runName,state:'running',result:{maxProviderCalls:2,maxUsd:0.01}}).select('run_name');if(claim.error?.code==='23505')return;assert.ifError(claim.error);
 const result={status:'running',checks:[],calls:[],productionWrites:0,syntheticDataOnly:true,actualTelegramLogin:false};let attempts=0;
 const check=(name,value)=>{assert.ok(value,name);result.checks.push({name,status:'PASS'});};
 const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 try{
  const {createAstrologyService}=await import('../dist/luna30-astrology-service.js'),{createAstrologyReportService}=await import('../dist/luna30-astrology-reports.js'),{resolveBirthLocation}=await import('../dist/luna30-locations.js'),{stagingAiMeterRecord}=await import('../dist/staging-ai-meter.js'),{createLunaResponseTransport}=await import('../dist/luna/response-transport.js');
  const availability=await fetch('https://api.openai.com/v1/models/gpt-5-mini',{headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`}});check('configured model is accessible to the existing server key',availability.status===200&&(await availability.json()).id==='gpt-5-mini');
  const owner=158467796,protection=async()=>{
   const [user,garden]=await Promise.all([supabase.from('users').select('lifetime_access,active_until,free_used').eq('telegram_id',owner).single(),supabase.from('moon_gardens').select('*').eq('telegram_id',owner)]);assert.ifError(user.error);assert.ifError(garden.error);return hash({user:user.data,garden:garden.data});
  };
  const before=await protection(),location=resolveBirthLocation('geonames:2643743'),ids=['35769e29-7986-48af-afab-77e89d273f01','35769e29-7986-48af-afab-77e89d273f02'];
  for(const[i,id]of ids.entries()){const saved=await supabase.from('luna30_birth_profiles').upsert({id,telegram_id:owner,subject_kind:'other',display_label:`Luna 3.0 synthetic QA ${i+1}`,birth_date:i?'2000-02-01':'1990-01-01',birth_time:'12:00',location,consent_version:'owner-approved-synthetic-qa'},{onConflict:'id',ignoreDuplicates:true});assert.ifError(saved.error);}
  const charts=createAstrologyService(supabase,()=>true),first=(await charts.calculate(owner,ids[0])).chart,second=(await charts.calculate(owner,ids[1])).chart;
  const transport=createLunaResponseTransport(()=>env.OPENAI_API_KEY);
  const reports=createAstrologyReportService(supabase,{enabled:()=>true,personalProfile:async()=>null,dailyLimit:async()=>100,transport:async(body,signal)=>{
   const request={...body};
   // Conservative byte-based input-token bound, including schema and overhead.
   // Each request is capped at $0.005 even if output fills its entire allowance.
   const inputBound=Buffer.byteLength(JSON.stringify(request))+256;
   request.max_output_tokens=Math.min(request.max_output_tokens,Math.floor((0.005-inputBound*0.00000025)/0.000002));
   check('bounded standard gpt-5-mini request',request.model==='gpt-5-mini'&&request.store===false&&request.service_tier==='default'&&request.max_output_tokens>=800&&request.max_output_tokens<=2400&&inputBound*0.00000025+request.max_output_tokens*0.000002<=0.005&&attempts<2);
   check('no personal context or raw birth data sent',JSON.parse(request.input[1].content).personal===null&&!JSON.stringify(request).includes('1990-01-01')&&!JSON.stringify(request).includes('2000-02-01'));
   attempts++;const response=await transport(request,signal),payload=await response.clone().json(),meter=stagingAiMeterRecord(payload);result.calls.push({httpStatus:response.status,...meter,maxOutputTokens:request.max_output_tokens,providerStatus:payload.status,diagnostic:payload.error?.code??payload.incomplete_details?.reason??null});await supabase.from('luna30_qa_report_runs').update({result}).eq('run_name',runName);return response;
  }});
  for(const [language,secondChartId]of [['en',null],['ru',second.id]]){
   const saved=await reports.generate(owner,{firstChartId:first.id,...(secondChartId?{secondChartId}:{}),language,consent:true});check(language+' persisted real AI report',Boolean(saved.report?.id)&&saved.report.report.sections.length===(secondChartId?5:7));
   const count=attempts,reopened=await reports.open(owner,first.id,secondChartId,language),replayed=await reports.generate(owner,{firstChartId:first.id,...(secondChartId?{secondChartId}:{}),language,consent:true});check(language+' reopen and duplicate use saved report without provider',reopened.report.id===saved.report.id&&replayed.report.id===saved.report.id&&attempts===count);
  }
  check('existing Moon Seeds and subscription untouched',await protection()===before);check('two real provider requests within approved allowance',attempts===2&&result.calls.every(c=>c.request_status==='success'&&c.estimated_cost!==null)&&result.calls.reduce((sum,c)=>sum+c.estimated_cost,0)<=0.01);
  result.status='PASS';
 }catch(error){result.status='FAIL';result.failure={code:error.code??error.name,message:String(error.message).slice(0,180)};}
 result.providerAttempts=attempts;await supabase.from('luna30_qa_report_runs').update({state:result.status==='PASS'?'completed':'failed',result}).eq('run_name',runName);
 console.log(JSON.stringify({luna30Smoke:result.status,attempts,calls:result.calls,checks:result.checks.length}));
}
