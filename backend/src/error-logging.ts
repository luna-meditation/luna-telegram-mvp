import crypto from 'node:crypto';
import type { Request } from 'express';

export type RequestWithId = Request & {
  requestId?: string;
};

type ErrorContext = {
  req?: RequestWithId;
  endpoint?: string;
  requestId?: string | null;
  telegramId?: number | string | null;
  plan?: string | null;
  stage?: string | null;
  reminderType?: string | null;
  deliveryId?: string | null;
  telegramApiError?: unknown;
  rpcName?: string;
  expectedParameterContract?: string;
  level?: 'error' | 'warn' | 'info';
  expected?: boolean;
};

/** Only inspect data properties; do not evaluate getters or custom inspect. */
function own(value:unknown,key:string):unknown {
  if(value===null||(typeof value!=='object'&&typeof value!=='function'))return undefined;
  try{const d=Object.getOwnPropertyDescriptor(value,key);return d&&'value' in d?d.value:undefined;}catch{return undefined;}
}
function fingerprint(value:unknown){
  return typeof value==='string'&&value.length>0?'ref-'+crypto.createHash('sha256').update(value.slice(0,1024)).digest('hex').slice(0,24):null;
}
const safeCodes=new Set(['23505','23503','23514','40001','42501','42P01','42883','42702','P0001','P0002','57014','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','insufficient_quota','rate_limit_exceeded','invalid_api_key','chart_source_changed','context_unavailable','memory_unavailable','owner_required','malformed_response']);
function codeFrom(error:unknown){
  const code=own(error,'code')??own(own(error,'error'),'code');
  return typeof code==='string'&&(safeCodes.has(code)||/^PGRST\d{3}$/.test(code))?code:null;
}
const routeWords=new Set('api profile me avatar luna tools chat conversations history memory memories universe discoveries astrology tarot daily breathing breath-sessions meditations progress garden seeds wallet subscription payments orders status health ready webhook telegram admin v4'.split(' '));
function endpointFrom(value:unknown){
  if(typeof value!=='string'||value.length>500)return 'backend';
  const match=/^(GET|POST|PATCH|PUT|DELETE|OPTIONS) (\/[^?\s]*)/.exec(value);
  if(!match)return 'backend';
  return match[1]+' '+match[2].split('/').slice(0,9).map(part=>!part?'':routeWords.has(part)?part:':value').join('/');
}
/** Schema v2 drops raw exception compatibility because even diagnostic text
 * can contain secrets or personal data. The caller still owns error handling. */
export function logBackendError(error: unknown, context: ErrorContext = {}) {
  const req=own(context,'req'),headers=own(req,'headers');
  const request=own(context,'requestId')??own(req,'requestId')??own(headers,'x-request-id');
  const actor=own(context,'telegramId')??own(own(req,'telegramUser'),'telegram_id');
  const actorNumber=typeof actor==='number'?actor:typeof actor==='string'&&/^\d{1,16}$/.test(actor)?Number(actor):NaN;
  const status=own(error,'status')??own(own(error,'response'),'status'),code=codeFrom(error);
  const payload={
    schemaVersion:2,
    errorCategory:code&&/^(?:PGRST|[0-9]|P000)/.test(code)?'database_error':error instanceof TypeError?'type_error':error instanceof RangeError?'range_error':error instanceof Error?'application_error':'external_error',
    errorCode:code,
    httpStatus:typeof status==='number'&&Number.isInteger(status)&&status>=100&&status<=599?status:null,
    endpoint:endpointFrom(own(context,'endpoint')),
    requestId:fingerprint(request)??'internal-'+crypto.randomUUID(),
    actorHash:Number.isSafeInteger(actorNumber)&&actorNumber>0?fingerprint(String(actorNumber)):null,
    stageHash:fingerprint(own(context,'stage')),
    operationHash:fingerprint(own(context,'rpcName')),
    deliveryHash:fingerprint(own(context,'deliveryId')),
    expected:own(context,'expected')===true
  };
  try{
    const level=own(context,'level');
    if(level==='info')console.info('[Luna backend exception]',payload);
    else if(level==='warn')console.warn('[Luna backend exception]',payload);
    else console.error('[Luna backend exception]',payload);
  }catch{/* Logging must not break the request's existing failure handling. */}
}
