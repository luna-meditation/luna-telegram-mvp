import assert from 'node:assert/strict';
import test from 'node:test';
import {luna34Achievements,luna34Categories,evaluateLuna34Achievements} from './luna34-achievements.js';
import {progressEventSchema,createLuna34Progress} from './luna34-progress.js';
import type {SupabaseClient} from '@supabase/supabase-js';
test('catalog is exactly the agreed 50 IDs, bilingual and independently illustrated, with no payment gate or reward activation',()=>{
 assert.equal(luna34Achievements.length,50);assert.equal(new Set(luna34Achievements.map(i=>i.id)).size,50);assert.equal(new Set(luna34Achievements.map(i=>i.art)).size,50);assert.equal(new Set(luna34Achievements.map(i=>i.artSubject)).size,50);
 assert.deepEqual(Object.fromEntries(Object.keys(luna34Categories).map(category=>[category,luna34Achievements.filter(i=>i.category===category).length])),{A:8,T:8,S:8,R:8,M:8,G:6,C:4});
 for(const item of luna34Achievements){assert.ok(item.title.en&&item.title.ru&&item.description.en&&item.description.ru);assert.ok(item.target>0);assert.equal('price' in item,false);}
});
for(const definition of luna34Achievements)test(definition.id+' deterministic threshold, no negative/NaN progress and no fabricated date',()=>{const locked=evaluateLuna34Achievements({[definition.metric]:definition.target-1},[]).find(i=>i.id===definition.id)!;assert.equal(locked.unlocked,false);assert.ok(locked.progress<100);const earned=evaluateLuna34Achievements({[definition.metric]:definition.target},[]).find(i=>i.id===definition.id)!;assert.equal(earned.unlocked,true);assert.equal(earned.reward,null);assert.equal(earned.unlockedAt,null);assert.equal(evaluateLuna34Achievements({[definition.metric]:NaN},[]).find(i=>i.id===definition.id)!.progress,0);});
test('stored earned timestamps never regress or become a payout on re-evaluation',()=>{const timestamp='2026-01-01T12:00:00Z';const earned=evaluateLuna34Achievements({},[{achievement_id:'A03',unlocked_at:timestamp}]).find(i=>i.id==='A03')!;assert.equal(earned.unlocked,true);assert.equal(earned.unlockedAt,timestamp);assert.equal(earned.reward,null);});
test('a legacy name or percentage cannot fabricate a stricter new achievement',()=>{const rows=luna34Achievements.flatMap(a=>a.legacyId?[{achievement_id:a.legacyId,unlocked_at:'2020-01-01T00:00:00Z',progress:100}]:[]);assert.ok(evaluateLuna34Achievements({},rows).every(a=>!a.unlocked&&a.unlockedAt===null));});
test('progress API rejects owner injection, counts, reward requests and unbounded metadata',()=>{const input={kind:'placement',entityId:'00000000-0000-4000-8000-000000000001',detail:'mercury'};assert.ok(progressEventSchema.safeParse(input).success);for(const value of [{owner:1},{delta:100},{reward:30},{detail:'x'.repeat(101)},{kind:'share_export'}])assert.equal(progressEventSchema.safeParse({...input,...value}).success,false);});
test('achievement acknowledgement accepts actual catalog IDs, binds the server owner and rejects forged input',async()=>{
 const calls:unknown[]=[];const db={async rpc(name:string,args:unknown){calls.push({name,args});return {data:true,error:null};}} as unknown as SupabaseClient;
 const service=createLuna34Progress(db);assert.deepEqual(await service.acknowledge(34,{ids:['A01','T08','C04']}),{acknowledged:true});
 assert.deepEqual(calls,[{name:'luna34_acknowledge_achievements',args:{p_owner:34,p_ids:['A01','T08','C04']}}]);
 for(const input of [{ids:['A01'],owner:35},{ids:['A\\d']},{ids:['bad']},{ids:[]}])await assert.rejects(service.acknowledge(34,input));assert.equal(calls.length,1);
});
