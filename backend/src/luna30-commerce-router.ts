import {Router} from 'express';import {z} from 'zod';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';import {supabase} from './db.js';import {env} from './config.js';import {createLuna30Commerce} from './luna30-commerce.js';import {bot} from './bot.js';
export const luna30Commerce=createLuna30Commerce(supabase,env,input=>bot.telegram.callApi('createInvoiceLink',input));
// The installed SDK predates these documented Bot API methods. Its shared
// authenticated callApi transport supports them; keep the extension narrow.
const starsLifecycleApi=bot.telegram.callApi.bind(bot.telegram) as unknown as (method:'editUserStarSubscription'|'refundStarPayment',input:{user_id:number;telegram_payment_charge_id:string;is_canceled?:boolean})=>Promise<boolean>;
export const luna30CommerceRouter=Router();
luna30CommerceRouter.use(requireTelegramWebApp,(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
luna30CommerceRouter.get('/admin/metrics',async(req,res,next)=>{try{if(!env.ADMIN_TELEGRAM_ID||(req as AuthenticatedRequest).telegramUser.telegram_id!==env.ADMIN_TELEGRAM_ID){res.status(403).json({code:'admin_only'});return;}const {data,error}=await supabase.rpc('luna30_commercial_metrics');if(error)throw error;res.json(data);}catch(e){next(e);}});
luna30CommerceRouter.post('/subscriptions/cancel',async(req,res,next)=>{try{
 const owner=(req as AuthenticatedRequest).telegramUser.telegram_id,input=z.object({chargeId:z.string().min(1).max(512),confirmed:z.literal(true)}).strict().parse(req.body);
 const receipt=await supabase.from('luna30_commercial_receipts').select('charge_id,order_id,state,subscription_expires_at,cancelled_at').eq('telegram_id',owner).eq('charge_id',input.chargeId).maybeSingle();
 if(receipt.error)throw receipt.error;if(!receipt.data||receipt.data.state!=='paid'||!receipt.data.subscription_expires_at){res.status(404).json({code:'subscription_not_found'});return;}
 if(receipt.data.cancelled_at){res.json({cancelled:true,accessUntil:receipt.data.subscription_expires_at});return;}
 const order=await supabase.from('luna30_commercial_orders').select('product').eq('telegram_id',owner).eq('id',receipt.data.order_id).single();if(order.error||order.data.product!=='premium_month')throw new Error('Subscription verification failed');
 const cancelled=await starsLifecycleApi('editUserStarSubscription',{user_id:owner,telegram_payment_charge_id:input.chargeId,is_canceled:true});if(!cancelled)throw new Error('Cancellation pending');
 const saved=await supabase.from('luna30_commercial_receipts').update({cancelled_at:new Date().toISOString()}).eq('telegram_id',owner).eq('charge_id',input.chargeId);if(saved.error)throw saved.error;res.json({cancelled:true,accessUntil:receipt.data.subscription_expires_at});
 }catch(e){next(e);}});
luna30CommerceRouter.post('/admin/refund',async(req,res,next)=>{try{
 if(!env.ADMIN_TELEGRAM_ID||(req as AuthenticatedRequest).telegramUser.telegram_id!==env.ADMIN_TELEGRAM_ID){res.status(403).json({code:'admin_only'});return;}
 const input=z.object({owner:z.number().int().positive(),chargeId:z.string().min(1).max(512),confirmed:z.literal(true)}).strict().parse(req.body),receipt=await supabase.from('luna30_commercial_receipts').select('stars,state').eq('telegram_id',input.owner).eq('charge_id',input.chargeId).maybeSingle();
 if(receipt.error)throw receipt.error;if(!receipt.data){res.status(404).json({code:'receipt_not_found'});return;}if(receipt.data.state!=='paid'){res.json({status:receipt.data.state,duplicate:true});return;}
 const refunded=await starsLifecycleApi('refundStarPayment',{user_id:input.owner,telegram_payment_charge_id:input.chargeId});if(!refunded)throw new Error('Refund requires reconciliation');
 res.json(await luna30Commerce.recordRefund(input.owner,{currency:'XTR',total_amount:receipt.data.stars,telegram_payment_charge_id:input.chargeId}));
 }catch(e){next(e);}});
luna30CommerceRouter.post('/orders',async(req,res,next)=>{try{res.json(await luna30Commerce.purchase((req as AuthenticatedRequest).telegramUser.telegram_id,req.body));}catch(e){next(e);}});
luna30CommerceRouter.get('/orders/:id',async(req,res,next)=>{try{const owner=(req as unknown as AuthenticatedRequest).telegramUser.telegram_id,id=z.string().uuid().parse(req.params.id);const {data,error}=await supabase.from('luna30_commercial_orders').select('id,product,stars,seeds,days,state,created_at').eq('telegram_id',owner).eq('id',id).maybeSingle();if(error)throw error;if(!data){res.status(404).json({code:'order_not_found'});return;}res.json({order:data});}catch(e){next(e);}});
