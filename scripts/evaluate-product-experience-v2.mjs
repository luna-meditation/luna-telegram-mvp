// Explicitly bounded QA. No app server, production DB, wallet or external tools.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,mkdir,rename,open,rm,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {companionRefinementCases} from '../backend/test/companion-refinement-cases.mjs';
import {productV2Cases} from '../backend/test/product-v2-eval-cases.mjs';
import {memoryRows} from '../backend/test/core-v1-eval-cases.mjs';
import {EvaluationBudget} from '../backend/test/core-v1-eval-budget.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),arg=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const companion=arg('--suite')==='companion-refinement',approval=companion?'companion_60_attempts_0_50_usd_synthetic_only':'v2_80_attempts_1_usd_synthetic_only';
const live=process.argv.includes('--live'),followup=false,out=resolve(arg('--out')??resolve(root,'../product-v2-evaluation-offline'));
const baseline=resolve(arg('--baseline')??resolve(root,'../luna-v2-baseline-6faafbd')),candidate=resolve(arg('--candidate')??root);
const keyFile=arg('--key-file');
try{
assert.equal(process.versions.node.split('.')[0],'22');
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
async function sourceDigest(folder){const rows=[];async function walk(path){for(const item of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const next=resolve(path,item.name);if(item.isDirectory())await walk(next);else if(item.isFile()&&item.name.endsWith('.ts')&&!item.name.endsWith('.test.ts'))rows.push([next.slice(folder.length),createHash('sha256').update(await readFile(next)).digest('hex')]);}}await walk(resolve(folder,'backend/src'));return hash(rows);}
const sourceDigests={baseline:await sourceDigest(baseline),candidate:await sourceDigest(candidate)};
await mkdir(out,{recursive:true});
const lock=await open(resolve(out,'run.lock'),'wx');await lock.close();
const dataset=companion?companionRefinementCases:productV2Cases;
const turnNumbers=item=>followup&&item.family==='deletion'?[1]:item.turns.map((_,index)=>index);
const budget=new EvaluationBudget(companion?500000:1000000,companion?60:80),results=[],turns=dataset.reduce((sum,item)=>sum+turnNumbers(item).length,0),startedAt=new Date().toISOString();
let campaignBudgetPath=null;
if(live&&followup){
 const priorPath=resolve(arg('--prior-results')??resolve(root,'../phase2-evaluation-live/results.json')),prior=JSON.parse(await readFile(priorPath,'utf8'));
 assert.equal(prior.mode,'live_provider');assert.equal(prior.budget.attempts,68);assert.equal(prior.budget.heldMicrousd,0);assert.ok(prior.budget.spentMicrousd>=0&&prior.budget.spentMicrousd<2000000);
 const campaignLock=await open(resolve(dirname(priorPath),'followup.lock'),'wx');await campaignLock.close();
 budget.attempts=prior.budget.attempts;budget.spent=prior.budget.spentMicrousd;campaignBudgetPath=resolve(dirname(priorPath),'campaign-budget.json');
}
let key;
const atomic=async(name,value)=>{const path=resolve(out,name);await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n');await rename(path+'.tmp',path);};
const persist=async()=>{await atomic('results.json',{version:2,approval,mode:live?'live_provider':'offline_request_fixtures',followupMemory:followup,startedAt,sourceRoots:{baseline,candidate},sourceDigests,datasetSha256:hash(dataset),config:{model:'gpt-5-mini-2025-08-07',appModel:'gpt-5-mini',promptVersion:'meet-luna4',centralChat:true,reasoningEffort:'minimal',generalOutputTokens:800,structuredOutputTokens:2600,store:false,serviceTier:'default'},budget:budget.snapshot(),scenarios:dataset.length,visibleTurnsPerVariant:turns,results,productionWrites:0,appProviderEvaluationScope:followup?'Candidate-only targeted follow-up against recorded initial outputs. Selected discovery cases now include the actual zero-provider opening used by the new UI; these are capability checks, not a same-input paired baseline score.':'Request construction and generated prose only; DB mutations and UI are verified separately with synthetic fixtures.',subjectiveHumanScores:null,pairedComparison:'Same user inputs, model snapshot, configuration and synthetic source projections; each variant receives its own real previous replies. Real guided opening and persistence are tested separately.'});if(campaignBudgetPath)await atomic(campaignBudgetPath,budget.snapshot());};
async function construct(sourceRoot,item,turn,history,variant){
 const name=`${item.id}-${turn}-${variant}`,inputPath=resolve(out,name+'.input.json'),output=resolve(out,name+'.request.json');
 await writeFile(inputPath,JSON.stringify({sourceRoot,item,turn,history,output,selectedOpening:true,memoryRows:item.family==='correction'&&turn===2?[]:memoryRows(item,turn),...(item.topic?{guidedEntry:{topic:item.topic,questionContext:'The user chose this direction; their situation is in the current message.'}}:{}),...(item.id==='return-reflection-ru'?{freshEntry:{question:'How could making one plan kinder help today?',basis:'A clearly framed reflection inspired by saved natal information, not a transit forecast.'}}:{})}));
 const env={PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',HOME:process.env.HOME,TMPDIR:process.env.TMPDIR??'/private/tmp',DOTENV_CONFIG_PATH:'/dev/null',BOT_TOKEN:'synthetic-only',BOT_USERNAME:'synthetic_test',MINI_APP_URL:'http://localhost',SUPABASE_URL:'http://127.0.0.1:9',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',AI_CHAT_MODEL:'gpt-5-mini',AI_PROMPT_VERSION:'meet-luna4',AI_MAX_OUTPUT_TOKENS:'800',AI_STRUCTURED_MAX_OUTPUT_TOKENS:'2600',AI_REASONING_EFFORT:'minimal',FEATURE_AI_CENTRAL_EXPERIENCE:'true',FEATURE_LUNA_INTELLIGENCE:'true',FEATURE_AI_MODES:'true',FEATURE_PERSONAL_MEMORY:'true',FEATURE_ASTROLOGY:'true',REMINDER_SCHEDULER_ENABLED:'false',NODE_OPTIONS:'--import '+JSON.stringify(resolve(root,'backend/test/intelligence-core-network-guard.mjs'))};
 const code=await new Promise(done=>{const process=spawn(globalThis.process.execPath,['--import',resolve(root,'backend/node_modules/tsx/dist/loader.mjs'),resolve(root,'backend/test/core-v1-eval-worker.mjs'),inputPath],{cwd:sourceRoot,env,stdio:['ignore','ignore','pipe']});let diagnostic='';process.stderr.on('data',chunk=>{diagnostic+=chunk.toString().slice(0,2000);});process.on('error',()=>done(127));process.on('close',code=>{if(code)console.error(JSON.stringify({requestConstructionFailed:name,code,diagnostic:diagnostic.slice(0,2000)}));done(code);});});
 assert.equal(code,0,'request_construction_failed');return JSON.parse(await readFile(output,'utf8'));
}
function observations(item,turn,text,request){
 const cyr=(text.match(/[а-яё]/giu)??[]).length,latin=(text.match(/[a-z]/giu)??[]).length;
 const metrics={replyLanguageHeuristic: text.length>0&&(item.language==='ru'?cyr>latin:cyr<5),forbiddenMemoryLeak:request.groundTruth.forbidden.some(value=>text.includes(value)),fabricatedExecutionClaim:/(?:\bI (?:have )?(?:saved|deleted|updated) (?:your|this|the)\b|(?:я )?(?:сохранила|удалила|обновила) (?:тво|это|запис))/iu.test(text),wordCount:text.trim().split(/\s+/).filter(Boolean).length};
 if(item.family==='continuity'&&turn===2)metrics.goalAndConstraintRetained=/draw|рисов/iu.test(text)&&/ten|10|десят/iu.test(text);
 if(item.family==='correction'&&turn===1)metrics.currentMemoryUsed=/evening|вечер/iu.test(text)&&!/morning|утр/iu.test(text);
 if(item.family==='deletion'&&turn===1||item.family==='correction'&&turn===2)metrics.deletedObservationNotRecalled=!/paper crane|бумажн.{0,12}журавл/iu.test(text);
 if(item.family==='no_history')metrics.noSpecificInventedHistory=!/you (?:work as|told me|have a partner)|ты (?:работаешь|рассказывал)|твой партн[её]р/iu.test(text);
 return metrics;
}
try{
 if(live){
  assert.equal(arg('--approval'),approval,'explicit_approval_required');assert.ok(keyFile,'approved_key_file_required');
  const permission=await stat(keyFile);assert.equal(permission.mode&0o077,0,'key_file_must_be_private');key=(await readFile(keyFile,'utf8')).trim();assert.match(key,/^sk-[A-Za-z0-9_-]{20,}$/);
 }
 await atomic('dataset.json',dataset);await persist();
 for(let caseIndex=0;caseIndex<dataset.length;caseIndex++){
  const item=dataset[caseIndex],histories={baseline:[],candidate:[]};
  for(const turn of turnNumbers(item)){
   for(const variant of followup?['candidate']:caseIndex%2?['candidate','baseline']:['baseline','candidate']){
    if(item.resetBefore.includes(turn))histories[variant]=[];
    const request=await construct(variant==='baseline'?baseline:candidate,item,turn,histories[variant],variant),body={...request.body,model:'gpt-5-mini-2025-08-07'},requestText=JSON.stringify(body);
    assert.equal(body.store,false);assert.equal(body.service_tier,'default');assert.ok(!body.tools?.length,'external_tools_forbidden');
    const result={caseId:item.id,family:item.family,turn,variant,inputSha256:hash(item.turns[turn]),requestSha256:hash(body),resolvedLanguage:request.language,expectedLanguage:item.language,requestContract:{correctResolvedLanguage:request.language===item.language,privateMemoryExcluded:!requestText.includes('PRIVATE_MEMORY_CANARY_47'),unsourcedMemoryExcluded:!requestText.includes('UNSOURCED_MEMORY_CANARY_48'),rawBirthInputsExcluded:!requestText.includes('2000-01-01'),identityMarker:requestText.includes('LUNA_IDENTITY_CORE_1.0')},status:live?'reserved':'offline_only',providerResult:null,objectiveMetrics:null};
    if(live){
     const reservation=budget.reserve(body);result.reservedMicrousd=reservation.ceiling;results.push(result);await persist();
     const before=performance.now();
     try{
      // Sole network destination. No retries, SDK fallback or redirects.
      const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
      result.httpStatus=response.status;result.latencyMs=Math.round(performance.now()-before);
      if(!response.ok){result.status='provider_http_error';result.errorCode='http_'+response.status;await persist();throw Error('provider_error_stop_no_retry');}
      const value=await response.json(),cost=budget.settle(reservation,value.usage);result.usageCostMicrousd=cost;result.providerResult=value;
      const prose=value.output?.filter(output=>output.type==='message').flatMap(output=>output.content??[]).filter(content=>content.type==='output_text').map(content=>content.text).join('\n')??'';
      let parsed;try{parsed=JSON.parse(prose);}catch{/* Record the real format failure; never make up a response. */}
      const text=parsed?.message??'';result.visibleMessage=text;result.status=value.status==='completed'&&typeof text==='string'&&text.length?'completed':'incomplete_or_invalid';result.objectiveMetrics=observations(item,turn,text,request);
      histories[variant].push({role:'user',content:item.turns[turn]},{role:'assistant',content:text||'[Provider response unavailable]'});
     }catch(error){result.status=result.status==='reserved'?'outcome_unknown':result.status;result.errorCode??='transport_or_usage_unverified';await persist();throw error;}
    }else{
     results.push(result);histories[variant].push({role:'user',content:item.turns[turn]},{role:'assistant',content:'OFFLINE_SYNTHETIC_HISTORY_ONLY — not an AI result.'});
    }
    await persist();console.log(JSON.stringify({case:item.id,turn,variant,status:result.status,...(live?budget.snapshot():{providerCalls:0})}));
   }
  }
 }
 await persist();await atomic('completion.json',{status:'COMPLETED',live,providerCalls:budget.attempts,budget:budget.snapshot(),noProductionWrites:true,completedAt:new Date().toISOString()});
}catch(error){await persist();console.error(JSON.stringify({status:'STOPPED_SAFELY',code:error instanceof Error?error.message:'evaluation_failed',budget:budget.snapshot(),noAutomaticRetry:true}));process.exitCode=1;}
finally{key=undefined;}
}finally{if(live&&keyFile)await rm(keyFile,{force:true});}
