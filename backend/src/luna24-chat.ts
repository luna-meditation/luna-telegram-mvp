import {Router} from 'express';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {env} from './config.js';
import {supabase,upsertUser} from './db.js';
import {requireTelegramWebApp,type AuthenticatedRequest} from './auth.js';
import {FoundationError} from './personalization.js';
import {getTarotReading,saveTarotReading,readingFields,type StoredReading} from './tarot.js';
import {saveTarotSpread,savePaidSingleTarot} from './tarot-spreads.js';
import {chatTarotInput,chatTarotState,chatTarotStateFromMetadata,storedChatTarotMetadata,chatTarotHash,drawChatTarot,readingSize,validChatTarotOrigin,type ChatTarotState} from './luna24-policy.js';
import {runTarotReveal} from './tarot-reveal-pipeline.js';
import {safetyCategory} from './luna-ai-policy.js';
import {createAstrologyWorkflowService} from './luna33-workflows.js';
import {createLuna34Progress} from './luna34-progress.js';
import {createLuna34Referrals} from './luna34-referrals.js';
import {recordFunnel} from './luna35-funnel.js';
import {getLuna21Order} from './luna21-commerce.js';
const messageFields='id,conversation_id,request_id,role,content,metadata,created_at';
const fail=(code:string,status=503)=>new FoundationError(status,code,'Your conversation remains saved.');
async function ownedConversation(user:number,id:string){const {data,error}=await supabase.from('ai_conversations').select('id,title').eq('id',id).eq('telegram_id',user).eq('status','active').maybeSingle();if(error)throw fail('chat_unavailable');if(!data)throw fail('conversation_not_found',404);return data;}
async function ownedMessage(user:number,id:string){const {data,error}=await supabase.from('ai_messages').select(messageFields).eq('id',z.string().uuid().parse(id)).eq('telegram_id',user).maybeSingle();if(error)throw fail('chat_unavailable');if(!data)throw fail('message_not_found',404);await ownedConversation(user,data.conversation_id);return data;}
export async function hydrateLunaTarotMessages(user:number,messages:Array<Record<string,unknown>>){
 if(!env.FEATURE_AI_CENTRAL_EXPERIENCE)return messages;
 const ids=[...new Set(messages.flatMap(m=>{const state=chatTarotState.safeParse((m.metadata as Record<string,unknown>|undefined)?.tarot);return state.success?[state.data.readingId]:[];}))],readings=new Map<string,StoredReading>();
 for(let offset=0;offset<ids.length;offset+=100){const {data,error}=await supabase.from('luna_tarot_readings').select(readingFields).eq('telegram_id',user).in('id',ids.slice(offset,offset+100)).returns<StoredReading[]>();if(error)throw fail('chat_unavailable');for(const r of data??[])readings.set(r.id,r);}
 return messages.map(m=>{const meta=m.metadata as Record<string,unknown>|undefined;const state=chatTarotState.safeParse(meta?.tarot);if(!state.success)return m;return {...m,metadata:{...meta,tarot:{...chatTarotStateFromMetadata(meta!),reading:readings.get(state.data.readingId)??null}}};});
}
async function response(user:number,message:Record<string,unknown>){return {conversationId:message.conversation_id,message:(await hydrateLunaTarotMessages(user,[message]))[0]};}
// Attachment is a saved-data operation, never a provider request or a reward event.
// Stable IDs + existing unique constraints make retries and simultaneous opens safe.
export async function attachSavedTarot(user:number,body:unknown){
 const {readingId,conversationId:requestedConversation}=z.object({readingId:z.string().uuid(),conversationId:z.string().uuid().optional()}).strict().parse(body);
 if(!env.FEATURE_AI_CENTRAL_EXPERIENCE||!env.FEATURE_TAROT_HISTORY)throw fail('feature_disabled',404);
 const reading=await getTarotReading(user,readingId) as StoredReading&{reading_kind?:string};
 if(requestedConversation)await ownedConversation(user,requestedConversation);
 let query=supabase.from('ai_messages').select(messageFields).eq('telegram_id',user).contains('metadata',{tarot:{readingId}});
 if(requestedConversation)query=query.eq('conversation_id',requestedConversation);
 const prior=await query.limit(1).maybeSingle();
 if(prior.error)throw fail('chat_unavailable');
 if(prior.data){await ownedConversation(user,prior.data.conversation_id);return response(user,prior.data);}
 const raw=createHash('sha256').update(`luna251:attach:${user}:${readingId}${requestedConversation?':'+requestedConversation:''}`).digest('hex');
 const messageId=`${raw.slice(0,8)}-${raw.slice(8,12)}-4${raw.slice(13,16)}-8${raw.slice(17,20)}-${raw.slice(20,32)}`,conversationId=requestedConversation??messageId;
 if(!requestedConversation){const created=await supabase.from('ai_conversations').upsert({id:conversationId,telegram_id:user,title:reading.language==='ru'?'Размышление с Таро':'Tarot reflection',language:reading.language},{onConflict:'id',ignoreDuplicates:true});if(created.error)throw fail('chat_unavailable');}
 await ownedConversation(user,conversationId);
 const kind=reading.reading_kind==='three'?'three':reading.reading_kind==='five'?'five':'single';
 const state:ChatTarotState={readingId,clientReadingId:reading.client_reading_id,kind,revealed:readingSize(kind),requestHash:createHash('sha256').update(`attached:${readingId}`).digest('hex')};
 const result=await supabase.from('ai_messages').upsert({id:messageId,conversation_id:conversationId,telegram_id:user,role:'assistant',message_type:'tarot_reading',request_id:`attach:${readingId}`,content:reading.interpretation?.summary??(reading.language==='ru'?'Расклад сохранён. Можно продолжить размышление здесь.':'Your reading is saved. You can continue reflecting here.'),metadata:{tarot:state}},{onConflict:'id',ignoreDuplicates:true});
 if(result.error)throw fail('reading_save_failed');return response(user,await ownedMessage(user,messageId));
}
export async function openChatTarot(user:number,body:unknown){
 const input=chatTarotInput.parse(body),hash=chatTarotHash(input);
 if(!env.FEATURE_AI_CENTRAL_EXPERIENCE||!env.FEATURE_TAROT_HISTORY)throw fail('feature_disabled',404);
 if(input.kind!=='single'&&!env.FEATURE_TAROT_SPREADS)throw fail('spreads_unavailable',404);
 if(safetyCategory(input.question))throw fail('tarot_safety',422);
 const {data:existing,error:readError}=await supabase.from('ai_messages').select(messageFields).eq('id',input.clientReadingId).eq('telegram_id',user).maybeSingle();if(readError)throw fail('chat_unavailable');
 if(existing){const state=chatTarotState.parse(existing.metadata?.tarot);if(state.requestHash!==hash||input.conversationId&&existing.conversation_id!==input.conversationId)throw fail('reading_conflict',409);
  if(input.orderId&&state.orderId!==input.orderId){
   if(state.orderId)throw fail('reading_order_conflict',409);
   const order=await getLuna21Order(user,input.orderId);
   if(order.kind!==state.kind||order.status!=='entitled'||order.client_reading_id!==null&&order.client_reading_id!==state.clientReadingId)throw fail('reading_order_conflict',409);
   const updated=await supabase.from('ai_messages').update({metadata:{...existing.metadata,tarot:{...state,orderId:order.id}}}).eq('id',existing.id).eq('telegram_id',user).is('metadata->tarot->>orderId',null).select(messageFields).maybeSingle();
   if(updated.error)throw fail('reading_save_failed');const saved=updated.data??await ownedMessage(user,existing.id);if(chatTarotState.parse(saved.metadata?.tarot).orderId!==order.id)throw fail('reading_order_conflict',409);return response(user,saved);
  }
  return response(user,existing);
 }
 if(input.actionMessageId){const source=await ownedMessage(user,input.actionMessageId);if(!validChatTarotOrigin(source,input))throw fail('action_conflict',409);}
 const conversationId=input.conversationId??input.clientReadingId;
 if(input.conversationId)await ownedConversation(user,conversationId);
 else{const created=await supabase.from('ai_conversations').upsert({id:conversationId,telegram_id:user,title:input.language==='ru'?'Размышление с Таро':'Tarot reflection',language:input.language},{onConflict:'id',ignoreDuplicates:true});if(created.error)throw fail('chat_unavailable');await ownedConversation(user,conversationId);}
 // A retry after the reading was saved but its chat attachment failed must reuse
 // the original draw, not pick different cards or charge another order.
 const stored=await supabase.from('luna_tarot_readings').select('card_id,orientation,cards,intention,question,language').eq('telegram_id',user).eq('client_reading_id',input.clientReadingId).maybeSingle();if(stored.error)throw fail('chat_unavailable');
 if(stored.data&&(stored.data.intention!==input.intention||stored.data.question!==input.question||stored.data.language!==input.language))throw fail('reading_conflict',409);
 const cards=stored.data?(stored.data.cards?.length?stored.data.cards:[{cardId:stored.data.card_id,orientation:stored.data.orientation}]):drawChatTarot(input.kind),base={clientReadingId:input.clientReadingId,intention:input.intention,question:input.question,language:input.language,generate:false};
 // Both interfaces call the existing authoritative reading services. No wallet or payment call.
 const saved=input.kind==='single'?(input.orderId?await savePaidSingleTarot(user,{reading:{...base,...cards[0]},orderId:input.orderId}):await saveTarotReading(user,{...base,...cards[0]})):await saveTarotSpread(user,{reading:{...base,kind:input.kind,cards},...(input.orderId?{orderId:input.orderId}:{})});
 const state:ChatTarotState={readingId:saved.reading.id,clientReadingId:input.clientReadingId,kind:input.kind,revealed:0,requestHash:hash,...(input.orderId?{orderId:input.orderId}:{})};
 const created=await supabase.from('ai_messages').insert({id:input.clientReadingId,conversation_id:conversationId,telegram_id:user,role:'assistant',message_type:'tarot_reading',request_id:`tarot:${input.clientReadingId}`,content:input.language==='ru'?'Открой карты по порядку. Посмотрим на вопрос с новой стороны.':'Reveal the cards in order. Let’s look at your question from another perspective.',metadata:{tarot:state,...(input.actionMessageId?{intelligence:{version:1,attachments:[],originActionId:input.actionMessageId}}:{})}}).select(messageFields).maybeSingle();
 if(created.error){if(created.error.code==='23505'){const m=await ownedMessage(user,input.clientReadingId);return response(user,m);}throw fail('reading_save_failed');}
 if(!created.data)throw fail('reading_save_failed');return response(user,created.data);
}
export async function revealChatTarot(user:number,id:string,body:unknown){
 try{return await runTarotReveal(body,{
  load:async()=>{const message=await ownedMessage(user,id);return{...message,metadata:{...message.metadata,tarot:chatTarotStateFromMetadata(message.metadata)}};},
  persist:async(message,prior,next)=>{const update=await supabase.from('ai_messages').update({metadata:storedChatTarotMetadata(message.metadata,next)}).eq('id',id).eq('telegram_id',user).contains('metadata',{tarot:{revealed:prior.revealed}}).select(messageFields).maybeSingle();if(update.error)throw fail('reveal_save_failed');return update.data??await ownedMessage(user,id);},
  reading:state=>getTarotReading(user,state.readingId) as Promise<StoredReading&{cards?:Array<{cardId:string}>}>,
  progress:async(state,cardId,complete)=>{const progress=createLuna34Progress(supabase,(owner,reference)=>createLuna34Referrals(supabase,{enabled:env.LUNA34_REFERRALS_ENABLED,botUsername:env.BOT_USERNAME}).qualify(owner,'tarot',reference));if(cardId)await progress.record(user,{kind:'reading_reveal',entityId:state.readingId,detail:cardId}).catch(()=>undefined);if(complete){await progress.record(user,{kind:'reading_reveal',entityId:state.readingId,detail:'complete'}).catch(()=>undefined);await recordFunnel(supabase,user,'first_tarot_completed','first','verified');}},
  render:message=>response(user,message),interpret:()=>interpretChatTarot(user,id,false),
  measure:metrics=>console.info('[Luna Tarot reveal timing]',metrics)
 });}catch(error){if(error instanceof Error&&error.message==='reveal_order')throw fail('reveal_order',409);throw error;}
}
export async function readChatTarot(user:number,id:string){return response(user,await ownedMessage(user,id));}
export async function interpretChatTarot(user:number,id:string,requireDeferred=true){
 let message=await ownedMessage(user,id);const current=chatTarotStateFromMetadata(message.metadata);
 if(current.revealed!==readingSize(current.kind)||requireDeferred&&!current.interpretationRequested)throw fail('reading_not_revealed',409);
  const reading=await getTarotReading(user,current.readingId) as StoredReading&{cards?:Array<{cardId:string;orientation:'upright'|'reversed'}>};
  // An opened history item is not authority to regenerate a ready/failed result.
  if(['ready','fallback','safety'].includes(reading.status))return response(user,message);
  if(requireDeferred){
   // The final reveal is permission for ONE initial attempt, not permission to
   // generate later merely because an old local reading is reopened. Claim
   // atomically before calling the existing accounting/interpretation service.
   if(current.interpretationAttempted||reading.status==='processing')return response(user,message);
   const claimed=await supabase.from('ai_messages').update({metadata:storedChatTarotMetadata(message.metadata,{...current,interpretationAttempted:true})}).eq('id',id).eq('telegram_id',user).contains('metadata',{tarot:{revealed:readingSize(current.kind)},tarotInterpretation:{version:1,requested:true}}).is('metadata->tarotInterpretation->>attempted',null).select(messageFields).maybeSingle();
   if(claimed.error)throw fail('reading_save_failed');if(!claimed.data)return response(user,await ownedMessage(user,id));message=claimed.data;
  }
  const base={clientReadingId:reading.client_reading_id,intention:reading.intention,question:reading.question,language:reading.language,generate:true};
  // Reservation RPCs handle idempotency and limits; timeout/fallback is never paid-retried.
  const result=current.kind==='single'?(current.orderId?await savePaidSingleTarot(user,{reading:{...base,cardId:reading.card_id,orientation:reading.orientation},orderId:current.orderId}):await saveTarotReading(user,{...base,cardId:reading.card_id,orientation:reading.orientation})):await saveTarotSpread(user,{reading:{...base,kind:current.kind,cards:reading.cards},...(current.orderId?{orderId:current.orderId}:{})});
  if(requireDeferred||result.reading.status==='ready'&&result.reading.interpretation){const updated=await supabase.from('ai_messages').update({...(result.reading.status==='ready'&&result.reading.interpretation?{content:result.reading.interpretation.summary}:{}),...(requireDeferred?{metadata:storedChatTarotMetadata(message.metadata,{...current,interpretationAttempted:true,interpretationFinished:true})}:{})}).eq('id',id).eq('telegram_id',user).select(messageFields).maybeSingle();if(updated.error)throw fail('reading_save_failed');message=updated.data??message;}
 return response(user,message);
}
export const luna24Router=Router();
luna24Router.use(requireTelegramWebApp,(_req,res,next)=>env.FEATURE_AI_CENTRAL_EXPERIENCE?next():res.status(404).json({code:'feature_disabled'}));
const astrologyWorkflows=createAstrologyWorkflowService(supabase,()=>env.FEATURE_ASTROLOGY);
luna24Router.post('/astrology',async(req,res,next)=>{try{const user=(req as unknown as AuthenticatedRequest).telegramUser;await upsertUser(user);res.json(await astrologyWorkflows.open(user.telegram_id,req.body));}catch(e){next(e);}});
luna24Router.post('/conversations/:id/context-reset',async(req,res,next)=>{try{
 if(!env.LUNA32_ENABLED)throw fail('feature_disabled',404);
 const user=(req as unknown as AuthenticatedRequest).telegramUser.telegram_id,id=z.string().uuid().parse(req.params.id),input=z.object({requestId:z.string().uuid(),language:z.enum(['en','ru'])}).strict().parse(req.body);
 await ownedConversation(user,id);
 const messageId=input.requestId;
 const saved=await supabase.from('ai_messages').upsert({id:messageId,telegram_id:user,conversation_id:id,request_id:'context-reset:'+messageId,role:'assistant',content:input.language==='ru'?'Контекст убран. Можно продолжить на другую тему.':'Context removed. We can continue with another topic.',metadata:{contextReset:true}},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw fail('context_unavailable');
 const message=await ownedMessage(user,messageId);if(message.conversation_id!==id||message.metadata?.contextReset!==true)throw fail('context_conflict',409);
 const updated=await supabase.from('ai_conversations').update({pending_state:{},conversation_state:{},updated_at:new Date().toISOString()}).eq('telegram_id',user).eq('id',id);if(updated.error)throw fail('context_unavailable');
 res.json({message});
}catch(e){next(e);}});
luna24Router.patch('/conversations/:id',async(req,res,next)=>{try{const user=(req as unknown as AuthenticatedRequest).telegramUser.telegram_id,id=z.string().uuid().parse(req.params.id),{title}=z.object({title:z.string().trim().min(1).max(60)}).strict().parse(req.body);await ownedConversation(user,id);const result=await supabase.from('ai_conversations').update({title,updated_at:new Date().toISOString()}).eq('id',id).eq('telegram_id',user).select('id,title').maybeSingle();if(result.error||!result.data)throw fail('rename_failed');res.json(result.data);}catch(e){next(e);}});
luna24Router.post('/tarot',async(req,res,next)=>{try{const user=(req as AuthenticatedRequest).telegramUser;await upsertUser(user);res.json(await openChatTarot(user.telegram_id,req.body));}catch(e){next(e);}});
luna24Router.post('/tarot/attach',async(req,res,next)=>{try{res.json(await attachSavedTarot((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.body));}catch(e){next(e);}});
luna24Router.post('/tarot/:id/reveal',async(req,res,next)=>{try{res.json(await revealChatTarot((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.params.id,req.body));}catch(e){next(e);}});
luna24Router.get('/tarot/:id',async(req,res,next)=>{try{res.set('Cache-Control','private, no-store');res.json(await readChatTarot((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.params.id));}catch(e){next(e);}});
luna24Router.post('/tarot/:id/interpret',async(req,res,next)=>{try{res.set('Cache-Control','private, no-store');res.json(await interpretChatTarot((req as unknown as AuthenticatedRequest).telegramUser.telegram_id,req.params.id));}catch(e){next(e);}});
