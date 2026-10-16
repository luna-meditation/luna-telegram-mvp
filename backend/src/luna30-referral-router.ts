import {Router} from 'express';import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';import {referralDashboard} from './luna30-referrals.js';
export const luna30ReferralRouter=Router();luna30ReferralRouter.use(requireTelegramWebApp);
luna30ReferralRouter.get('/',async(req,res,next)=>{try{res.setHeader('cache-control','no-store');res.json(await referralDashboard((req as AuthenticatedRequest).telegramUser.telegram_id));}catch(e){next(e);}});
luna30ReferralRouter.post('/link',async(req,res,next)=>{try{if(Object.keys(req.body??{}).length){res.status(400).json({code:'invalid_request'});return;}res.setHeader('cache-control','no-store');res.json(await referralDashboard((req as AuthenticatedRequest).telegramUser.telegram_id,true));}catch(e){next(e);}});
