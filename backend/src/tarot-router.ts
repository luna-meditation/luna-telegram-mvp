import express, {Router} from 'express';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';
import {env} from './config.js';
import {saveTarotReading,listTarotReadings,getTarotReading,deleteTarotReading,openDailyTarot} from './tarot.js';
import {saveTarotSpread,savePaidSingleTarot} from './tarot-spreads.js';
export const tarotRouter=Router();
// Mounted before the server-wide parser (raw upload routes must stay raw).
// Keep JSON parsing with this router so real API POSTs work in every host.
tarotRouter.use(express.json({limit:'16kb'}),requireTelegramWebApp,(_req,res,next)=>env.FEATURE_TAROT_HISTORY?next():res.status(404).json({code:'feature_disabled'}));
tarotRouter.post('/readings',async(req,res,next)=>{try{res.json(await saveTarotReading((req as AuthenticatedRequest).telegramUser.telegram_id,req.body));}catch(error){next(error);}});
tarotRouter.post('/daily',async(req,res,next)=>{try{res.json(await openDailyTarot((req as AuthenticatedRequest).telegramUser.telegram_id,req.body));}catch(error){next(error);}});
tarotRouter.post('/spreads',async(req,res,next)=>{try{res.json(await saveTarotSpread((req as AuthenticatedRequest).telegramUser.telegram_id,req.body));}catch(error){next(error);}});
tarotRouter.post('/paid-single',async(req,res,next)=>{try{res.json(await savePaidSingleTarot((req as AuthenticatedRequest).telegramUser.telegram_id,req.body));}catch(error){next(error);}});
tarotRouter.get('/readings',async(req,res,next)=>{try{res.json(await listTarotReadings((req as AuthenticatedRequest).telegramUser.telegram_id,req.query.offset));}catch(error){next(error);}});
tarotRouter.get('/readings/:id',async(req,res,next)=>{try{res.json(await getTarotReading((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.params.id));}catch(error){next(error);}});
tarotRouter.delete('/readings/:id',async(req,res,next)=>{try{await deleteTarotReading((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.params.id);res.json({ok:true});}catch(error){next(error);}});
