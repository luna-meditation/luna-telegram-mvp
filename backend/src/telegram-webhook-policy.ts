import {createHmac,timingSafeEqual} from 'node:crypto';
import type {RequestHandler} from 'express';

// Domain-separated server secret: no extra credential, no token in URLs/logs.
// Telegram stores this value when setWebhook is called and echoes it in a header.
export function telegramWebhookSecret(botToken:string) {
 return createHmac('sha256',botToken).update('luna:telegram:webhook:v1').digest('hex');
}
export function validTelegramWebhookHeader(header:unknown,secret:string) {
 if(typeof header!=='string'||header.length!==secret.length)return false;
 const actual=Buffer.from(header),expected=Buffer.from(secret);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function requireTelegramWebhookSecret(secret:string):RequestHandler {
 return (req,res,next)=>{
  if(!validTelegramWebhookHeader(req.get('X-Telegram-Bot-Api-Secret-Token'),secret)){
   res.status(403).json({code:'invalid_webhook'});return;
  }
  next();
 };
}
