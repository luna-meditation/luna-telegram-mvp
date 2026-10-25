import assert from 'node:assert/strict';
import test from 'node:test';
import {logBackendError} from './error-logging.js';
test('error telemetry keeps codes/correlation without raw exceptions or personal canaries',()=>{
 const original=console.error,events:unknown[]=[];console.error=(...args:unknown[])=>{events.push(args);};
 try{const secret='SYNTHETIC_CANARY_PERSONAL_42',error=Object.assign(new Error(secret),{code:'23505',details:secret,hint:secret,status:503,cause:{password:secret}}),context={endpoint:'GET /api/profile/me?token='+secret,requestId:secret,telegramId:42,stage:secret,rpcName:'reserve_luna_chat_request',telegramApiError:{secret}};logBackendError(error,context);logBackendError(error,context);
 const a=(events[0] as unknown[])[1] as Record<string,unknown>,b=(events[1] as unknown[])[1] as Record<string,unknown>;assert.equal(a.errorCode,'23505');assert.equal(a.httpStatus,503);assert.equal(a.endpoint,'GET /api/profile/me');assert.equal(a.schemaVersion,2);assert.equal(a.requestId,b.requestId);assert.equal(a.actorHash,b.actorHash);assert.equal(a.originalException,undefined);assert.equal(a.stack,undefined);assert.equal(a.telegramId,undefined);assert.doesNotMatch(JSON.stringify(events),new RegExp(secret));assert.ok(JSON.stringify(events).length<2000);
 }finally{console.error=original;}
});
test('telemetry does not evaluate getters, toJSON or custom inspect of hostile/circular exceptions',()=>{
 const original=console.warn,events:unknown[]=[];console.warn=(...args:unknown[])=>{events.push(args);};let called=0;
 try{const error:Record<string,unknown>={toJSON(){called++;throw Error('must not run');}};error.cause=error;for(const key of ['message','stack','code','status','response','error'])Object.defineProperty(error,key,{get(){called++;throw Error('must not run');}});logBackendError(error,{level:'warn',endpoint:'POST /api/luna/SECRET_PATH?password=secret',requestId:'secret\nforged log'});assert.equal(called,0);assert.doesNotMatch(JSON.stringify(events),/SECRET_PATH|password|forged log|toJSON/);assert.ok(JSON.stringify(events).length<1000);
 }finally{console.warn=original;}
});
test('a broken logging sink cannot replace the caller application error',()=>{const original=console.error;console.error=()=>{throw Error('sink unavailable');};try{assert.doesNotThrow(()=>logBackendError(Error('private')));}finally{console.error=original;}});
