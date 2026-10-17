// Provider-free final verification; cannot dispatch inventory/batch/AI calls.
import assert from'node:assert/strict';import{authorizeLuna32Smoke,luna32StagingSite}from'../dist/luna32-staging-guard.js';
export async function run(request,context,options){
 if(!authorizeLuna32Smoke(request,context.site?.id,options)||Netlify.env.get('SUPABASE_URL')!=='https://funvzpmpbgazsisehiru.supabase.co')return new Response(null,{status:403});
 const{netlifyStagingHandler}=await import('../dist/netlify-staging-handler.js');await netlifyStagingHandler(new Request('https://luna-staging-itfl.netlify.app/health'),{site:{id:luna32StagingSite},ip:'127.0.0.1'});
 const{env}=await import('../dist/config.js'),{supabase:db}=await import('../dist/db.js');assert.ok(env.STAGING_MODE&&env.SUPABASE_URL==='https://funvzpmpbgazsisehiru.supabase.co');
 if(options.readOnly){const r=await db.from('luna30_qa_report_runs').select('state,result').eq('run_name','luna41-foundation-'+options.sourceCommit.slice(0,12)).maybeSingle();assert.ifError(r.error);return Response.json({state:'not_started',result:null,foundation:r.data},{headers:{'Cache-Control':'private, no-store'}});}
 const command=await request.json();if(command.action!=='foundation')return Response.json({code:'provider_actions_disabled'},{status:403});
 const{runFoundation}=await import('./luna41-staging-foundation.mjs');await runFoundation(db,env,options.sourceCommit);return new Response(null,{status:204});
}
