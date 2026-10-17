import {Router} from 'express';
import {z} from 'zod';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';
import {supabase} from './db.js';
import {env} from './config.js';
import {getLunaUsage} from './luna-ai.js';
import {luna35Commerce} from './luna35-runtime.js';
import {commerceViews} from './luna35-commerce-policy.js';
import {openChatTarot,hydrateLunaTarotMessages} from './luna24-chat.js';
import {createAstrologyWorkflowService} from './luna33-workflows.js';
import {FoundationError} from './foundation-error.js';
import {buyLuna21Reading} from './luna21-commerce.js';
import {recordFunnel} from './luna35-funnel.js';
import {upsertUser} from './db.js';
export const luna35Router=Router();
const service=luna35Commerce(getLunaUsage),owner=(req:unknown)=>(req as AuthenticatedRequest).telegramUser.telegram_id;
luna35Router.use(requireTelegramWebApp,(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
luna35Router.post('/launch',async(req,res,next)=>{try{z.object({}).strict().parse(req.body);const signed=(req as AuthenticatedRequest),user=await upsertUser(signed.telegramUser),session=req.get('x-telegram-init-data')??new Date().toISOString().slice(0,10);await recordFunnel(supabase,owner(req),'mini_app_launched',session,'app');if(signed.telegramStartParam?.startsWith('ref_'))await recordFunnel(supabase,owner(req),'referral_link_opened',session,'app');if(user.created_at&&Date.now()-Date.parse(user.created_at)<120000)await recordFunnel(supabase,owner(req),'new_user_authenticated','first','verified');res.json({recorded:true});}catch(e){next(e);}});
luna35Router.get('/admin/funnel',async(req,res,next)=>{try{if(owner(req)!==env.ADMIN_TELEGRAM_ID){res.status(403).json({code:'admin_only'});return;}const r=await supabase.rpc('luna35_funnel_stats',{p_days:30});if(r.error)throw r.error;res.json(r.data);}catch(e){next(e);}});
luna35Router.get('/commerce',async(req,res,next)=>{try{const input=z.object({view:z.enum(commerceViews).default('wallet'),language:z.enum(['en','ru']).default('en'),conversationId:z.string().uuid().optional()}).strict().parse(req.query);res.json(await service.card(owner(req),input.view,input.language,input.conversationId));}catch(e){next(e);}});
luna35Router.get('/pending-actions',async(req,res,next)=>{try{const input=z.object({conversationId:z.string().uuid().optional()}).strict().parse(req.query);res.json({actions:await service.pending(owner(req),input.conversationId)});}catch(e){next(e);}});
luna35Router.post('/pending-actions',async(req,res,next)=>{try{res.json({action:await service.savePending(owner(req),req.body)});}catch(e){next(e);}});
luna35Router.post('/pending-actions/:id/resume',async(req,res,next)=>{try{
 const user=owner(req),confirmation=z.object({confirmed:z.literal(true),expectedSeeds:z.number().int().nonnegative().max(10000).optional()}).strict().parse(req.body);
 const result=await service.resume(user,z.string().uuid().parse(req.params.id),async(action,identity,prior)=>{
  if(prior){const reference=z.object({messageId:z.string().uuid(),conversationId:z.string().uuid()}).strict().parse(prior);const m=await supabase.from('ai_messages').select('id,role,content,metadata,created_at,conversation_id').eq('telegram_id',user).eq('conversation_id',identity.conversationId).eq('id',reference.messageId).maybeSingle();if(m.error||!m.data)throw new FoundationError(404,'saved_result_not_found','This result was removed. It will not be regenerated.');return{conversationId:identity.conversationId,message:(await hydrateLunaTarotMessages(user,[m.data]))[0] as unknown as {id:string}};}
  if(action.type==='tarot'){const order=identity.seedCost>0?await buyLuna21Reading(user,{requestId:identity.id,kind:action.kind,currency:'SEEDS',expectedAmount:identity.seedCost,confirmed:true,termsAccepted:true},async()=>{throw new Error('No Stars invoice in a Seeds continuation');}):null;return await openChatTarot(user,{clientReadingId:identity.id,conversationId:identity.conversationId,kind:action.kind,intention:action.intention,question:action.question,language:identity.language,...(order?{orderId:order.order.id}:{})}) as unknown as {conversationId:string;message:{id:string}};}
  if(identity.seedCost>0)throw new FoundationError(409,'direct_purchase_unavailable','This report purchase is not active. Your balance is unchanged.');
  const ids=action.type==='compatibility'?[action.chartId,action.secondChartId]:[action.chartId],r=await supabase.from('luna30_chart_cache').select('id,profile_id').eq('telegram_id',user).in('id',ids);if(r.error||r.data?.length!==ids.length)throw new FoundationError(404,'chart_not_found','Select your chart again.');
  return createAstrologyWorkflowService(supabase,()=>env.FEATURE_ASTROLOGY).open(user,{requestId:identity.id,conversationId:identity.conversationId,language:identity.language,kind:action.type,firstProfileId:r.data.find(c=>c.id===ids[0])!.profile_id,...(ids[1]?{secondProfileId:r.data.find(c=>c.id===ids[1])!.profile_id}:{})});
 },confirmation.expectedSeeds);res.json(result);
 }catch(e){next(e);}});
