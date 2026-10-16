import {Router} from 'express';
import {z} from 'zod';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';
import {supabase} from './db.js';
import {env} from './config.js';
import {createAstrologyService} from './luna30-astrology-service.js';
export const luna30AstrologyRouter=Router();
const service=createAstrologyService(supabase,()=>env.FEATURE_ASTROLOGY);
luna30AstrologyRouter.use(requireTelegramWebApp,(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
// Every route below is behind the signature-verifying middleware above.
const owner=(req:unknown)=>(req as AuthenticatedRequest).telegramUser.telegram_id;
luna30AstrologyRouter.get('/locations',async(req,res,next)=>{try{const q=z.string().max(80).parse(req.query.q??'');res.json(await service.locations(q));}catch(e){next(e);}});
luna30AstrologyRouter.get('/profiles',async(req,res,next)=>{try{res.json(await service.list(owner(req as AuthenticatedRequest)));}catch(e){next(e);}});
luna30AstrologyRouter.post('/profiles',async(req,res,next)=>{try{res.status(201).json(await service.save(owner(req as AuthenticatedRequest),req.body));}catch(e){next(e);}});
luna30AstrologyRouter.put('/profiles/:id',async(req,res,next)=>{try{res.json(await service.save(owner(req),req.body,z.string().uuid().parse(req.params.id)));}catch(e){next(e);}});
luna30AstrologyRouter.delete('/profiles/:id',async(req,res,next)=>{try{res.json(await service.remove(owner(req),z.string().uuid().parse(req.params.id)));}catch(e){next(e);}});
luna30AstrologyRouter.post('/profiles/:id/chart',async(req,res,next)=>{try{z.object({}).strict().parse(req.body??{});res.json(await service.calculate(owner(req),z.string().uuid().parse(req.params.id)));}catch(e){next(e);}});
luna30AstrologyRouter.get('/charts/:id',async(req,res,next)=>{try{res.json(await service.open(owner(req),z.string().uuid().parse(req.params.id)));}catch(e){next(e);}});
luna30AstrologyRouter.post('/compatibility',async(req,res,next)=>{try{const body=z.object({firstChartId:z.string().uuid(),secondChartId:z.string().uuid()}).strict().parse(req.body);res.json(await service.compatibility(owner(req as AuthenticatedRequest),body.firstChartId,body.secondChartId));}catch(e){next(e);}});
