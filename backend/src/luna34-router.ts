import {Router} from 'express';
import {z} from 'zod';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';
import {supabase,upsertUser} from './db.js';
import {createLuna34Progress} from './luna34-progress.js';
import {readLuna34Membership} from './luna34-membership.js';
import {getLunaUsage} from './luna-ai.js';
import {betaEntitlement,readLuna32Settings} from './luna32-runtime.js';
import {env} from './config.js';
import {issueShareExportTicket,verifyShareExportTicket,shareExportSchema} from './luna34-share-proof.js';
import {tarotCatalog} from './tarot-policy.js';
import {luna34AchievementIds} from './luna34-achievements.js';
import {createLuna34Referrals} from './luna34-referrals.js';
import {createLuna30Commerce} from './luna30-commerce.js';
import {bot} from './bot.js';
import {recordFunnel} from './luna35-funnel.js';
import {readPublishedEditorial} from './luna42-editorial.js';
export const luna34Router=Router();
const referrals=createLuna34Referrals(supabase,{enabled:env.LUNA34_REFERRALS_ENABLED,botUsername:env.BOT_USERNAME});
const progress=createLuna34Progress(supabase,(owner,id)=>referrals.qualify(owner,'tarot',id)),owner=(req:unknown)=>(req as AuthenticatedRequest).telegramUser.telegram_id;
luna34Router.use(requireTelegramWebApp,(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
luna34Router.get('/progress',async(req,res,next)=>{try{res.json(await progress.snapshot(owner(req)));}catch(e){next(e);}});
luna34Router.get('/referrals',async(req,res,next)=>{try{res.json(await referrals.dashboard(owner(req)));}catch(e){next(e);}});
luna34Router.post('/referrals/link',async(req,res,next)=>{try{z.object({}).strict().parse(req.body);res.json(await referrals.dashboard(owner(req),true));}catch(e){next(e);}});
luna34Router.post('/referrals/onboarding',async(req,res,next)=>{try{z.object({completed:z.literal(true)}).strict().parse(req.body);res.json(await referrals.finishOnboarding(owner(req)));}catch(e){next(e);}});
luna34Router.get('/membership',async(req,res,next)=>{try{const [membership,usage,settings,products]=await Promise.all([readLuna34Membership(supabase,owner(req),env.LUNA34_COMMERCIAL_ENABLED),getLunaUsage(owner(req)),readLuna32Settings(supabase),createLuna30Commerce(supabase,env,input=>bot.telegram.callApi('createInvoiceLink',input)).availability()]);if(membership.membership.paid){products.premium_month=false;products.premium_year=false;}await recordFunnel(supabase,owner(req),'membership_viewed',new Date().toISOString().slice(0,10),'app');res.json({...membership,products,usage,beta:betaEntitlement(settings)});}catch(e){next(e);}});
luna34Router.get('/admin/metrics',async(req,res,next)=>{try{if(!env.ADMIN_TELEGRAM_ID||owner(req)!==env.ADMIN_TELEGRAM_ID){res.status(403).json({code:'admin_only'});return;}const result=await supabase.rpc('luna34_operating_metrics');if(result.error)throw result.error;res.json(result.data);}catch(e){next(e);}});
luna34Router.post('/progress/events',async(req,res,next)=>{try{res.json(await progress.record(owner(req),req.body));}catch(e){next(e);}});
luna34Router.post('/progress/acknowledge',async(req,res,next)=>{try{res.json(await progress.acknowledge(owner(req),req.body));}catch(e){next(e);}});
// Evidence means a supported image export/native-share invocation, not proof of
// an external post. No questions, messages, birth data or image pixels are sent.
luna34Router.post('/share/prepare',async(req,res,next)=>{try{const input=shareExportSchema.parse(req.body);let valid=input.kind==='app'&&!input.asset;
 const editorial=input.asset?await readPublishedEditorial(supabase,env.SUPABASE_URL).catch(()=>[]):[],publishedArt=editorial.find(e=>e.kind===input.kind&&e.body.image===input.asset);
 if(input.kind==='tarot')valid=tarotCatalog.some(card=>input.asset===`/assets/tarot/cards/${card.id}.webp`||publishedArt?.key===card.id);
 if(input.kind==='garden')valid=Boolean(input.asset&&/^\/assets\/moon-garden\/level-[0-7]-[a-z-]+\.png$/.test(input.asset));
 if(input.kind==='natal'||input.kind==='compatibility'){const ids=[input.reference,...(input.kind==='compatibility'?[input.secondReference]:[])];if(!input.asset&&ids.every(Boolean)&&new Set(ids).size===ids.length){const r=await supabase.from('luna30_chart_cache').select('id,profile_id').eq('telegram_id',owner(req)).in('id',ids as string[]);valid=!r.error&&r.data?.length===ids.length&&new Set(r.data.map(c=>c.profile_id)).size===ids.length;}}
 if(input.kind==='achievement'){const id=input.asset?.match(/^\/images\/achievements\/luna34\/([atsrmgc][0-9]{2})\.webp$/)?.[1]?.toUpperCase()??publishedArt?.key;if(id&&luna34AchievementIds.has(id)){const r=await supabase.from('achievements').select('unlocked_at').eq('telegram_id',owner(req)).eq('achievement_id',id).maybeSingle();valid=!r.error&&Boolean(r.data?.unlocked_at);}}
 if(!valid){res.status(422).json({code:'unsupported_export'});return;}res.json({ticket:issueShareExportTicket(env.BOT_TOKEN,owner(req),input)});
 }catch(e){next(e);}});
luna34Router.post('/share/complete',async(req,res,next)=>{try{const input=z.object({ticket:z.string().max(1200),outcome:z.enum(['download_invoked','native_share_completed']),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().min(1000).max(15000000)}).strict().parse(req.body);let ticket;try{ticket=verifyShareExportTicket(env.BOT_TOKEN,owner(req),input.ticket);}catch{res.status(422).json({code:'invalid_export_ticket'});return;}
 const settings=await supabase.from('luna34_progress_settings').select('enabled').eq('id',true).maybeSingle();if(settings.error)throw settings.error;if(!settings.data?.enabled){res.json({recorded:false});return;}
 const result=await supabase.from('luna34_progress_events').upsert({telegram_id:owner(req),kind:'share_export',entity_id:ticket.entityId,detail:'supported_export'},{onConflict:'telegram_id,kind,entity_id,detail',ignoreDuplicates:true});if(result.error)throw result.error;res.json({recorded:true});
 }catch(e){next(e);}});
luna34Router.post('/breath/start',async(req,res,next)=>{try{const input=z.object({clientId:z.string().uuid(),mode:z.enum(['calm','box','478','coherent','triangle','sigh','anxiety_reset','sleep','morning_energy']),duration:z.union([z.literal(60),z.literal(180),z.literal(300),z.literal(600)])}).strict().parse(req.body);await upsertUser((req as AuthenticatedRequest).telegramUser);const result=await supabase.rpc('luna34_start_breath',{p_owner:owner(req),p_client:input.clientId,p_mode:input.mode,p_duration:input.duration});if(result.error)throw result.error;res.json(result.data);}catch(e){next(e);}});
luna34Router.post('/breath/:id/heartbeat',async(req,res,next)=>{try{const id=z.string().uuid().parse(req.params.id),input=z.object({active:z.boolean()}).strict().parse(req.body);const result=await supabase.rpc('luna34_breath_heartbeat',{p_owner:owner(req),p_session:id,p_active:input.active});if(result.error)throw result.error;res.json(result.data);}catch(e){next(e);}});
