import {z} from 'zod';
import {intelligencePractices,type IntelligenceActionId} from './luna-intelligence-contract.js';
import {lunaDestinations,type LunaDestinationId} from './luna41-navigation.js';
import type {LunaIntentResolution} from './luna-ai-intent.js';
import {resolveIntelligenceCommand} from './luna-intelligence-command.js';
/** Legacy wellness routing treated any "choose/show/suggest" as meditation.
 * In the general companion, ambiguous requests belong to structured tools. */
export function intelligenceMeditationRequest(message:string){return resolveIntelligenceCommand(message)?.action==='meditation.recommend'||/\b(?:meditat(?:i)?on|audio practice|what (?:should I|to) listen)\b|медитац|что.{0,15}послушать/iu.test(message);}
export function scopeIntelligenceIntent(intent:LunaIntentResolution,message:string):LunaIntentResolution{
 if(intent.action==='none'||intelligenceMeditationRequest(message)||['explicit_catalog_title_action','confirmation_continues_persisted_meditation_action','short_reply_resolves_previous_meditation_choice'].includes(intent.reason))return intent;
 return{...intent,intent:'general_chat',goal:null,topic:null,action:'none',meditationId:null,continuation:false,reason:'intelligence_requires_semantic_tool_selection'};
}
export const intelligenceActionInputs={
 'tarot.start':z.object({kind:z.enum(['single','three','five']).nullable(),intention:z.enum(['general','love','career','growth']).default('general'),question:z.string().trim().max(240).default('')}).strict(),
 'tarot.select_spread':z.object({kind:z.enum(['single','three','five'])}).strict(),
 'tarot.retrieve':z.object({id:z.string().uuid()}).strict(),
 'astrology.natal':z.object({}).strict(),
 'astrology.profile':z.object({id:z.string().uuid().optional()}).strict(),
 'astrology.compatibility':z.object({}).strict(),
 'astrology.compatibility_report':z.object({id:z.string().uuid()}).strict(),
 'meditation.recommend':z.object({goal:z.string().trim().max(160)}).strict(),
 'meditation.open':z.object({id:z.string().uuid()}).strict(),
 'breathing.start':z.object({practiceId:z.enum(intelligencePractices),minutes:z.union([z.literal(1),z.literal(3),z.literal(5),z.literal(10)])}).strict(),
 'cosmos.open':z.object({}).strict(),
 'profile.propose_update':z.object({}).strict(),
 'journal.open':z.object({}).strict(),
 'journal.retrieve':z.object({query:z.string().trim().min(1).max(200)}).strict(),
 'history.retrieve':z.object({query:z.string().trim().min(1).max(200)}).strict(),
 'settings.language':z.object({}).strict(),
 'navigation.open':z.object({destination:z.enum(lunaDestinations.map(d=>d.id) as [LunaDestinationId,...LunaDestinationId[]])}).strict(),
 'wallet.balance':z.object({}).strict(),
 'premium.entitlements':z.object({}).strict(),
 'ai.allowance':z.object({}).strict(),
 'commerce.options':z.object({view:z.enum(['shop','earn','premium'])}).strict(),
 'capability.unavailable':z.object({capability:z.enum(['file_generation','unsupported_calculation','unknown_birth_time'])}).strict(),
 'safety.support':z.object({category:z.enum(['self_harm','medical_emergency','violence'])}).strict()
} satisfies Record<IntelligenceActionId,z.ZodTypeAny>;
export {resolveIntelligenceCommand,requestedSpread,type IntelligenceCommand} from './luna-intelligence-command.js';
export const intelligenceToolToAction={
 start_tarot_reading:'tarot.start',start_breathing_session:'breathing.start',get_tarot_reading:'tarot.retrieve',
 open_saved_natal_chart:'astrology.natal',get_natal_chart:'astrology.natal',get_birth_profiles:'astrology.profile',
 open_compatibility:'astrology.compatibility',get_compatibility_report:'astrology.compatibility_report',calculate_compatibility:'astrology.compatibility_report',
 recommend_meditation:'meditation.recommend',get_meditation_catalog:'meditation.recommend',
 get_user_entitlements:'premium.entitlements',check_ai_quota:'ai.allowance',get_wallet_balance:'wallet.balance',
 get_remaining_quotas:'ai.allowance',get_product_catalog:'commerce.options',get_earning_opportunities:'commerce.options',
 propose_memory_change:'profile.propose_update',get_journal_context:'journal.retrieve',find_previous_conversation:'history.retrieve'
} as const;
