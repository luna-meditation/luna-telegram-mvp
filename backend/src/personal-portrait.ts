import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {resolvePersonalBirth,numerologyFromBirth,birthContextAvailability} from './personal-context-engine.js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import type {PersonalMemory} from './personal-memory-policy.js';
import type {PersonalProfile} from './personalization-policy.js';
import {symbolicChartFacts} from './luna30-astrology-report-policy.js';
import type {NatalCalculation} from './luna30-astrology-engine.js';
import {calculateDateOnlySun} from './luna30-astrology-engine.js';
import {createHash} from 'node:crypto';
import {toolOperationId} from './luna40-actions.js';
import {portraitDiscussionInput,portraitDiscussionOpening} from './portrait-discussion-policy.js';
import type {PortraitPersistence} from './personal-portrait-policy.js';

type PortraitInput={memories:PersonalMemory[];profile:PersonalProfile;memoryEnabled:boolean};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const projectionVersion='luna4.0-portrait-v2';
const unavailable=()=>new FoundationError(503,'portrait_unavailable','Could not verify your personal portrait. Your saved data are unchanged.');
const missing=(error:{code?:string}|null)=>error?.code==='PGRST202';

async function projectPersonalPortrait(db:SupabaseClient,owner:number,input:PortraitInput,asOf:string){
 const birth=await resolvePersonalBirth(db,owner);
 let chart:{id:string;facts:ReturnType<typeof symbolicChartFacts>}|null=null;
 if(birth.selected?.source==='birth_profile'){
  const cached=await db.from('luna30_chart_cache').select('id,calculation').eq('telegram_id',owner).eq('profile_id',birth.selected.id).eq('profile_revision',birth.selected.revision!).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(cached.error)throw new FoundationError(503,'portrait_unavailable','Could not verify your calculated portrait.');
  if(cached.data)chart={id:cached.data.id,facts:symbolicChartFacts(cached.data.calculation as NatalCalculation)};
 }
 return{...buildPersonalPortrait({...input,hasBirth:birth.available}),birth:birthContextAvailability(birth),numerology:numerologyFromBirth(birth,asOf),dateOnlySun:birth.selected?calculateDateOnlySun(birth.selected.date):null,chart};
}

/** Old deployments without the additive RPC retain their live portrait, with
 * an explicit unavailable persistence state. Permission/connection errors do
 * not fall through. The loader is called AFTER the source epoch is read. */
export async function readPersonalPortrait(db:SupabaseClient,owner:number,input:PortraitInput|(()=>Promise<PortraitInput>),asOf=new Date().toISOString().slice(0,10)){
 if(typeof input!=='function')return{...await projectPersonalPortrait(db,owner,input,asOf),persistence:{state:'unavailable'} as PortraitPersistence};
 for(let attempt=0;attempt<2;attempt++){
  const epoch=await db.rpc('luna4_portrait_epoch',{p_owner:owner});
  if(missing(epoch.error))return{...await projectPersonalPortrait(db,owner,await input(),asOf),persistence:{state:'unavailable'} as PortraitPersistence};
  if(epoch.error||!Number.isSafeInteger(epoch.data))throw unavailable();
  const cached=await db.from('luna4_portrait_snapshots').select('document,revision,source_epoch,created_at').eq('telegram_id',owner).eq('source_epoch',epoch.data).eq('as_of',asOf).contains('document',{projectionVersion}).order('revision',{ascending:false}).limit(1).maybeSingle();
  if(cached.error)throw unavailable();
  if(cached.data){const c=cached.data;return{...c.document,persistence:{state:'saved',revision:c.revision,sourceEpoch:c.source_epoch,createdAt:c.created_at,cached:true,sectionDigests:c.document.sectionDigests} as PortraitPersistence} as Awaited<ReturnType<typeof projectPersonalPortrait>>&{persistence:PortraitPersistence;sectionDigests:Record<string,string>};}
  const projection=await projectPersonalPortrait(db,owner,await input(),asOf),sectionDigests=Object.fromEntries(Object.entries({...projection.sections,astrology:{birth:projection.birth,chart:projection.chart,numerology:projection.numerology,dateOnlySun:projection.dateOnlySun}}).map(([key,value])=>[key,digest(value)])),document={...projection,sectionDigests,projectionVersion};
  const saved=await db.rpc('luna4_save_portrait_snapshot',{p_owner:owner,p_epoch:epoch.data,p_digest:digest(document),p_day:asOf,p_document:document});
  if(saved.error)throw unavailable();
  if(saved.data?.status==='source_changed')continue;
  if(saved.data?.status!=='saved')throw unavailable();
  return{...document,persistence:{state:'saved',revision:saved.data.revision,sourceEpoch:epoch.data,createdAt:saved.data.createdAt,cached:saved.data.cached,sectionDigests} as PortraitPersistence};
 }
 throw new FoundationError(409,'portrait_source_changed','Your profile changed. Reopen the portrait before continuing.');
}

export function createPortraitDiscussion(db:SupabaseClient,load:(owner:number)=>Promise<PortraitInput>){return{
 async open(owner:number,raw:unknown){
  const input=portraitDiscussionInput.parse(raw),portrait=await readPersonalPortrait(db,owner,()=>load(owner));
  if(portrait.persistence.state!=='saved')throw new FoundationError(503,'portrait_migration_required','The saved portrait discussion is not available yet. No AI request or charge was made.');
  const opening=portraitDiscussionOpening(portrait,input.section,input.language);
  const conversation=toolOperationId(owner,input.operationId,'portrait.conversation',JSON.stringify({section:input.section,language:input.language})),message=toolOperationId(owner,input.operationId,'portrait.message',JSON.stringify({section:input.section,language:input.language}));
  const result=await db.rpc('luna4_open_portrait_discussion',{p_owner:owner,p_message:message,p_conversation:conversation,p_operation:input.operationId,p_epoch:portrait.persistence.sourceEpoch,p_section:input.section,p_language:input.language,p_content:opening.content,p_sources:opening.sources});
  if(result.error)throw unavailable();
  if(result.data?.status==='source_changed')throw new FoundationError(409,'portrait_source_changed','Your profile changed. Reopen the portrait before continuing.');
  if(result.data?.status!=='opened'||!result.data.conversationId||!result.data.message)throw unavailable();
  // Also protects an incremental code rollout against the older RPC replay
  // behavior: an old quoted source must not become a new contextual opening.
  if(result.data.message.metadata?.portraitDiscussion?.sourceEpoch!==portrait.persistence.sourceEpoch)throw new FoundationError(409,'portrait_source_changed','Your profile changed. Start this exploration again.');
  return{conversationId:result.data.conversationId,message:result.data.message,cached:result.data.cached};
 }
};}
