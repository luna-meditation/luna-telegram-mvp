import express,{Router} from 'express';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';
import {luna21Offers,buyLuna21Reading,getLuna21Order} from './luna21-commerce.js';
import {bot} from './bot.js';
export const luna21CommerceRouter=Router();
luna21CommerceRouter.use(express.json({limit:'4kb'}),requireTelegramWebApp);
luna21CommerceRouter.get('/offers',async(_req,res,next)=>{try{res.json(await luna21Offers());}catch(e){next(e);}});
luna21CommerceRouter.get('/orders/:id',async(req,res,next)=>{try{res.json(await getLuna21Order((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.params.id));}catch(e){next(e);}});
luna21CommerceRouter.post('/orders',async(req,res,next)=>{try{res.json(await buyLuna21Reading((req as AuthenticatedRequest).telegramUser.telegram_id,req.body,input=>bot.telegram.createInvoiceLink(input)));}catch(e){next(e);}});
