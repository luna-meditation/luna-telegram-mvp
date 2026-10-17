import assert from 'node:assert/strict';import test from 'node:test';
import {issueShareExportTicket,verifyShareExportTicket,shareExportSchema} from './luna34-share-proof.js';
test('export completion is owner-bound, signed, short-lived and idempotent per artwork; never proof of an external post',()=>{
 const body={kind:'app',format:'story'},ticket=issueShareExportTicket('synthetic-test-secret',123,body,1000),valid=verifyShareExportTicket('synthetic-test-secret',123,ticket,1001);
 assert.match(valid.entityId,/^[a-f0-9-]{36}$/);assert.equal(verifyShareExportTicket('synthetic-test-secret',123,issueShareExportTicket('synthetic-test-secret',123,body,2000),2001).entityId,valid.entityId);
 assert.throws(()=>verifyShareExportTicket('synthetic-test-secret',456,ticket,1001));assert.throws(()=>verifyShareExportTicket('wrong-secret',123,ticket,1001));assert.throws(()=>verifyShareExportTicket('synthetic-test-secret',123,ticket,601001));assert.throws(()=>shareExportSchema.parse({...body,question:'private'}));
});
