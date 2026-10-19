import {createHash,randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {parseCurrentCommercialCatalog} from './luna4-commercial-catalog.js';
import {readContractBenefits} from './luna4-contract-benefits.js';
import {hasBetaFeature,readLuna32Settings} from './luna32-runtime.js';
import {withAiOperation} from './luna32-ai-accounting.js';
import {astrologyReportKey} from './luna30-astrology-report-policy.js';
import {createAstrologyReportService} from './luna30-astrology-reports.js';
import {calculateSynastry,type NatalCalculation} from './luna30-astrology-engine.js';
import type {RelationshipKind} from './luna40-compatibility.js';
export type CompatibilityReportInput={firstChartId:string;secondChartId?:string;language:'en'|'ru';consent:true;relationship?:RelationshipKind;requestId?:string;confirmed?:true;expectedSeeds?:number;catalogRevision?:number};
const unavailable=()=>new FoundationError(503,'compatibility_purchase_unavailable','Your saved reports, subscription and Moon Seeds are preserved.');
/** One adapter around the existing report engine and existing purchase journal.
 * Opening/quoting is read-only. Only an explicit, exact, server-quoted purchase
 * may substitute for the initial AI allowance; follow-up chat is separate. */
export function createCompatibilityProducts(db:SupabaseClient,reports:ReturnType<typeof createAstrologyReportService>,enabled:()=>boolean){
 async function quote(owner:number,input:Omit<CompatibilityReportInput,'consent'>){
  const saved=await reports.open(owner,input.firstChartId,input.secondChartId??null,input.language,input.relationship);
  if(saved.report||!input.secondChartId)return{...saved,access:{seeds:0,revision:0,available:true,source:saved.report?'saved_result':'existing_allowance'}};
  const cfg=await db.from('luna34_commercial_settings').select('catalog,catalog_revision,checkout_enabled,owner_approved,live_payment_verified,luna4_activation_verified,luna4_cutover_at').eq('id',true).single();if(cfg.error)throw unavailable();
  const catalog=parseCurrentCommercialCatalog(cfg.data.catalog);if(catalog.version!=='luna-4.0-completion-v1')return{...saved,access:{seeds:0,revision:cfg.data.catalog_revision,available:true,source:'existing_allowance'}};
  const runtime=await readLuna32Settings(db),contract=await readContractBenefits(db,owner,true);
  if(hasBetaFeature(runtime,'astrology')||contract?.paid&&contract.preserveLegacy)return{...saved,access:{seeds:0,revision:cfg.data.catalog_revision,available:true,source:hasBetaFeature(runtime,'astrology')?'public_beta':'original_paid_rights'}};
  return{...saved,access:{seeds:catalog.seeds.compatibility,revision:cfg.data.catalog_revision,available:enabled()&&runtime.generation_enabled&&runtime.cost_baseline_verified&&cfg.data.checkout_enabled&&cfg.data.owner_approved&&cfg.data.live_payment_verified&&cfg.data.luna4_activation_verified&&Date.parse(cfg.data.luna4_cutover_at??'')<=Date.now(),source:'moon_seeds'}};
 }
 return{
  open:quote,
  async generate(owner:number,input:CompatibilityReportInput){
   const offer=await quote(owner,input);if(offer.report)return{report:offer.report,cached:true};
   if(offer.access.seeds===0)return reports.generate(owner,input);
   if(!offer.access.available)throw unavailable();
   if(!input.secondChartId||!input.relationship)throw new FoundationError(422,'relationship_required','Choose two different charts and the relationship context.');
   if(!input.confirmed||!input.requestId||input.expectedSeeds!==offer.access.seeds||input.catalogRevision!==offer.access.revision)throw new FoundationError(409,'compatibility_confirmation_required','Confirm the actual quoted price before continuing.');
   // Validate both actual, owned calculation objects before any wallet mutation.
   const charts=await db.from('luna30_chart_cache').select('id,profile_id,calculation').eq('telegram_id',owner).in('id',[input.firstChartId,input.secondChartId]);if(charts.error)throw unavailable();const first=charts.data?.find(c=>c.id===input.firstChartId),second=charts.data?.find(c=>c.id===input.secondChartId);
   if(!first||!second||first.profile_id===second.profile_id)throw new FoundationError(422,'different_charts_required','Choose two different owned birth profiles.');
   calculateSynastry(first.calculation as NatalCalculation,second.calculation as NatalCalculation);
   const key=astrologyReportKey(owner,first.id,second.id,'compatibility',input.language,input.relationship),parameters={firstChartId:first.id,secondChartId:second.id,language:input.language,relationship:input.relationship,cacheKey:key,consent:true},hash=createHash('sha256').update(JSON.stringify(parameters)).digest('hex');
   const purchase=await db.rpc('luna4_purchase_compatibility',{p_owner:owner,p_request:input.requestId,p_hash:hash,p_expected:input.expectedSeeds,p_revision:input.catalogRevision,p_parameters:parameters});if(purchase.error||!purchase.data)throw unavailable();
   if(purchase.data.status==='cached'){const reopened=await reports.open(owner,first.id,second.id,input.language,input.relationship);if(!reopened.report)throw unavailable();return{report:reopened.report,cached:true};}
   if(!purchase.data.purchase)throw new FoundationError(purchase.data.status==='insufficient'?402:409,purchase.data.status==='insufficient'?'insufficient_seeds':'compatibility_'+purchase.data.status,'Check the saved result and current price before retrying.');
   const id=purchase.data.purchase.id,lease=randomUUID(),args={p_owner:owner,p_purchase:id,p_lease:lease},claim=await db.rpc('luna4_claim_compatibility_purchase',args);if(claim.error||!claim.data)throw unavailable();
   if(claim.data.status==='ready'){const reopened=await reports.open(owner,first.id,second.id,input.language,input.relationship);if(!reopened.report)throw unavailable();return{report:reopened.report,cached:true};}
   if(claim.data.status!=='claimed')throw new FoundationError(409,'compatibility_'+claim.data.status,'Delivery is already being checked. Do not pay again.');
   const finish=(result:unknown)=>db.rpc('luna4_finish_compatibility_purchase',{...args,p_result:result});
   try{
    const result=await withAiOperation(db,owner,'compatibility:'+id,()=>reports.generate(owner,input,{paidPurchaseId:id}));
    // A race may discover a previously saved report before dispatch. It is not
    // a paid delivery: return the exact original Seed split, then reopen free.
    const done=await finish(result.cached?null:{reportId:result.report.id,cacheKey:key,firstChartId:first.id,secondChartId:second.id,language:input.language,relationship:input.relationship});if(done.error||done.data!==true)throw unavailable();
    return result;
   }catch(error){const recovered=await finish(null);if(recovered.error||recovered.data!==true){const current=await reports.open(owner,first.id,second.id,input.language,input.relationship);if(current.report)return{report:current.report,cached:true};throw new FoundationError(503,'compatibility_review_required','Delivery needs review. No duplicate debit or generation was started.');}throw error;}
  }
 };
}
