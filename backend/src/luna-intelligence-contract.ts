/** Public, dependency-free wire contract. Both the server and React renderer use
 * this discriminant; visible labels never select an attachment implementation. */
export const intelligenceVersion = 1 as const;
export const intelligenceActions = [
  'tarot.start','tarot.select_spread','tarot.retrieve','astrology.natal',
  'astrology.profile','astrology.compatibility','astrology.compatibility_report',
  'meditation.recommend','meditation.open','breathing.start','cosmos.open',
  'profile.propose_update','journal.open','journal.retrieve','history.retrieve',
  'settings.language','wallet.balance','premium.entitlements','ai.allowance',
  'commerce.options','capability.unavailable','safety.support','navigation.open'
] as const;
export type IntelligenceActionId = typeof intelligenceActions[number];
export type IntelligenceLanguage = 'en'|'ru';
export type IntelligenceSpread = 'single'|'three'|'five';
export const intelligencePractices = ['calm','box','478','coherent','triangle','sigh','anxiety_reset','sleep','morning_energy'] as const;
export type IntelligencePractice = typeof intelligencePractices[number];
export type IntelligenceStatus = 'REQUESTED'|'VALIDATED'|'AUTHORIZED'|'EXECUTED'|'CONFIRMED'|'FAILED';
export type IntelligenceAccess = 'included'|'user_action'|'confirmation_required'|'needs_profile'|'needs_consent'|'unavailable';
type Base<T extends string,P> = {version:1;id:string;operationId:string;action:IntelligenceActionId;type:T;status:IntelligenceStatus;access:IntelligenceAccess;payload:P;error?:{code:string;retryable:boolean}};
export type IntelligenceAttachment =
  | Base<'tarot_reading',{stage:'choose'|'saved';kind:IntelligenceSpread|null;clientReadingId?:string;readingId?:string;intention:'general'|'love'|'career'|'growth';question:string;originMessageId?:string}>
  | Base<'natal_chart',{stage:'select'|'ready';chartId?:string;profileId?:string;reportId?:string}>
  | Base<'compatibility_report',{stage:'select'|'ready';chartId?:string;secondChartId?:string;reportId?:string;comparisonId?:string;firstProfileId?:string;secondProfileId?:string;relationship?:'romantic'|'business'|'friendship'|'family';calculationVersion?:string}>
  | Base<'meditation',{meditationId:string}>
  | Base<'breathing_session',{practiceId:IntelligencePractice;minutes:1|3|5|10;sessionId?:string;completed?:boolean}>
  | Base<'moon_seeds_offer',{view:'wallet'|'shop'|'earn'|'quota'|'resume'|'history';pendingActionId?:string}>
  | Base<'premium_offer',{view:'premium'}>;
export type IntelligenceReference =
  | {type:'tarot_reading';id:string}
  | {type:'natal_chart';id:string;profileId?:string;reportId?:string}
  | {type:'compatibility_report';id:string;chartId:string;secondChartId:string;reportId?:string;comparisonId?:string;relationship?:'romantic'|'business'|'friendship'|'family'};
export type IntelligenceMetadata = {version:1;requestHash?:string;action?:IntelligenceActionId;attachments:IntelligenceAttachment[];originActionId?:string;title?:{value:string;updatedAt:string};context?:{active:IntelligenceReference|null;language:IntelligenceLanguage};retrieval?:{characters:number;estimatedTokens:number;latencyMs:number;sources:number}};
export const intelligenceUuid = (v:unknown):v is string => typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const record = (v:unknown):v is Record<string,unknown> => Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const oneOf = (v:unknown,values:readonly unknown[]) => values.includes(v);
const keys = (v:Record<string,unknown>,allowed:string[]) => Object.keys(v).every(k=>allowed.includes(k));
const optionalIds = (v:Record<string,unknown>,names:string[]) => names.every(k=>v[k]===undefined||intelligenceUuid(v[k]));
export function isIntelligenceAttachment(value:unknown):value is IntelligenceAttachment {
  if(!record(value)||!keys(value,['version','id','operationId','action','type','status','access','payload','error'])||value.version!==1||!intelligenceUuid(value.id)||!intelligenceUuid(value.operationId)||!oneOf(value.action,intelligenceActions)||!oneOf(value.status,['REQUESTED','VALIDATED','AUTHORIZED','EXECUTED','CONFIRMED','FAILED'])||!oneOf(value.access,['included','user_action','confirmation_required','needs_profile','needs_consent','unavailable'])||!record(value.payload))return false;
  if(value.error!==undefined&&(!record(value.error)||!keys(value.error,['code','retryable'])||typeof value.error.code!=='string'||!/^[a-z_]{3,80}$/.test(value.error.code)||typeof value.error.retryable!=='boolean'))return false;
  const p=value.payload;
  const allowed:Record<string,readonly IntelligenceActionId[]>={tarot_reading:['tarot.start','tarot.select_spread','tarot.retrieve'],natal_chart:['astrology.natal','astrology.profile'],compatibility_report:['astrology.compatibility','astrology.compatibility_report'],meditation:['meditation.recommend','meditation.open'],breathing_session:['breathing.start'],moon_seeds_offer:['wallet.balance','commerce.options','ai.allowance'],premium_offer:['premium.entitlements','commerce.options']};
  if(!allowed[String(value.type)]?.includes(value.action as IntelligenceActionId))return false;
  switch(value.type){
    case 'tarot_reading':return keys(p,['stage','kind','clientReadingId','readingId','intention','question','originMessageId'])&&oneOf(p.kind,['single','three','five',null])&&oneOf(p.intention,['general','love','career','growth'])&&typeof p.question==='string'&&p.question.length<=240&&optionalIds(p,['clientReadingId','readingId','originMessageId'])&&(p.stage==='choose'&&intelligenceUuid(p.clientReadingId)||p.stage==='saved'&&p.kind!==null&&intelligenceUuid(p.readingId));
    case 'natal_chart':return keys(p,['stage','chartId','profileId','reportId'])&&optionalIds(p,['chartId','profileId','reportId'])&&(p.stage==='select'||p.stage==='ready'&&intelligenceUuid(p.chartId));
    case 'compatibility_report':return keys(p,['stage','chartId','secondChartId','reportId','comparisonId','firstProfileId','secondProfileId','relationship','calculationVersion'])&&optionalIds(p,['chartId','secondChartId','reportId','comparisonId','firstProfileId','secondProfileId'])&&(p.relationship===undefined||oneOf(p.relationship,['romantic','business','friendship','family']))&&(p.calculationVersion===undefined||typeof p.calculationVersion==='string'&&p.calculationVersion.length<=80)&&(p.stage==='select'||p.stage==='ready'&&intelligenceUuid(p.chartId)&&intelligenceUuid(p.secondChartId)&&p.chartId!==p.secondChartId);
    case 'meditation':return keys(p,['meditationId'])&&intelligenceUuid(p.meditationId);
    case 'breathing_session':return keys(p,['practiceId','minutes','sessionId','completed'])&&oneOf(p.practiceId,intelligencePractices)&&oneOf(p.minutes,[1,3,5,10])&&optionalIds(p,['sessionId'])&&(p.completed===undefined||typeof p.completed==='boolean');
    case 'moon_seeds_offer':return keys(p,['view','pendingActionId'])&&oneOf(p.view,['wallet','shop','earn','quota','resume','history'])&&optionalIds(p,['pendingActionId']);
    case 'premium_offer':return keys(p,['view'])&&p.view==='premium';
    default:return false;
  }
}
export function validatedIntelligenceAttachments(value:unknown):IntelligenceAttachment[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();return value.slice(0,4).filter((item):item is IntelligenceAttachment=>{
    if(!isIntelligenceAttachment(item)||seen.has(item.id))return false;seen.add(item.id);return true;
  });
}
