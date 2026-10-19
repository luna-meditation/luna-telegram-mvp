import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import {emptyPersonalProfile} from './personalization-policy.js';
import {portraitDiscussionInput,portraitDiscussionOpening,portraitDiscussionSections} from './portrait-discussion-policy.js';
import {readPersonalPortrait,createPortraitDiscussion} from './personal-portrait.js';
import type {PersonalMemory} from './personal-memory-policy.js';
const at='2026-10-19T00:00:00Z';
const row=(overrides:Partial<PersonalMemory>={}):PersonalMemory=>({id:randomUUID(),category:'goals',memory_key:'drawing',memory_value:'Make time for drawing',confirmation_status:'confirmed',memory_kind:'fact',is_sensitive:false,source_type:'user_entered',source_message_id:null,revision:1,created_at:at,updated_at:at,confirmed_at:at,...overrides});
function portrait(memories:PersonalMemory[]=[],consent=true){return buildPersonalPortrait({memories,profile:{...emptyPersonalProfile,ai_context_consent:consent},memoryEnabled:consent,hasBirth:false});}
for(const language of ['ru','en'] as const)for(const section of portraitDiscussionSections)test(`zero-provider ${language} ${section} opening asks exactly one contextual question`,()=>{
 const p=portrait([row()]),result=portraitDiscussionOpening(p,section,language);assert.equal(result.section,section);assert.equal((result.content.match(/\?/g)??[]).length,1);assert.ok(result.question.length>20);assert.ok(result.content.length<650);assert.doesNotMatch(result.content,/buy|купить|диагноз|предсказыва|destiny|diagnosis/i);
});
test('opening uses only consented confirmed non-sensitive facts, never AI inferences or birth guesses',()=>{
 const secret=row({is_sensitive:true,memory_value:'PRIVATE_SYNTHETIC'}),symbol=row({category:'reflections',memory_kind:'symbolic',memory_value:'SYMBOLIC_SYNTHETIC'}),pending=row({confirmation_status:'pending',memory_value:'PENDING_SYNTHETIC'}),normal=row();
 for(const consent of [false,true])for(const section of portraitDiscussionSections){const result=portraitDiscussionOpening(portrait([secret,symbol,pending,normal],consent),section,'en');assert.doesNotMatch(result.content,/PRIVATE_SYNTHETIC|SYMBOLIC_SYNTHETIC|PENDING_SYNTHETIC/);if(!consent)assert.equal(result.sources.length,0);}
 const result=portraitDiscussionOpening(portrait([normal]),'direction','ru');assert.equal(result.sources[0].id,normal.id);assert.match(result.content,/Make time for drawing/);
});
test('structured opening input forbids owners, arbitrary sections and automatic consent',()=>{const input={operationId:randomUUID(),section:'direction',language:'ru'};assert.equal(portraitDiscussionInput.parse(input).section,'direction');for(const extra of [{owner:2},{confirmed:true},{conversationId:randomUUID()},{section:'payments'}])assert.equal(portraitDiscussionInput.safeParse({...input,...extra}).success,false);});
test('stable portrait ordering avoids unnecessary versions for equal timestamps',()=>{const a=row({id:'00000000-0000-4000-8000-000000000001'}),b=row({id:'00000000-0000-4000-8000-000000000002'});assert.deepEqual(portrait([a,b]),portrait([b,a]));});
test('portrait progress matches the six visible chapters, not hidden categories or assumed traits',()=>{const goals=[row({memory_key:'cosmos_growth'}),row({memory_key:'values',category:'preferences'}),row()];assert.deepEqual(portrait(goals).completion,{provided:1,total:6});const p=buildPersonalPortrait({memories:goals,profile:{...emptyPersonalProfile,interests:['tarot']},memoryEnabled:false,hasBirth:true});assert.deepEqual(p.completion,{provided:2,total:6});assert.equal(p.sections.strengths.length,0);assert.equal(p.memoryPermission,false);});

type FetchCall={path:string;body:Record<string,unknown>|null};
function client(handler:(call:FetchCall)=>Response){const calls:FetchCall[]=[];return{calls,db:createClient('https://fixture.invalid','synthetic-only-not-a-secret',{global:{fetch:async(input,init)=>{const path=String(input),body=typeof init?.body==='string'?JSON.parse(init.body):null,call={path,body};calls.push(call);return handler(call);}},auth:{persistSession:false,autoRefreshToken:false}})};}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
test('cached portrait performs no memory reload, provider generation or wallet access',async()=>{
 let loads=0;const p={...portrait(),birth:{available:false,selectionRequired:false},numerology:{calculated:false},chart:null,sectionDigests:{essence:'a'},projectionVersion:'luna4.0-portrait-v2'};
 const f=client(({path})=>path.includes('/rpc/luna4_portrait_epoch')?json(4):path.includes('/luna4_portrait_snapshots?')?json({document:p,revision:8,source_epoch:4,created_at:at}):json({message:'Unexpected request'},500));
 const result=await readPersonalPortrait(f.db,1,async()=>{loads++;throw Error('must not reload');});assert.equal(loads,0);assert.equal(result.persistence.state,'saved');if(result.persistence.state==='saved'){assert.equal(result.persistence.revision,8);assert.equal(result.persistence.cached,true);}assert.equal(f.calls.length,2);assert.ok(f.calls[1].path.includes('telegram_id=eq.1'));assert.ok(f.calls.every(c=>!/ai_|ledger|payment/.test(c.path)));
});
test('permissions and connection failures do not masquerade as an absent migration',async()=>{let loads=0;for(const code of ['42501','08006']){const f=client(()=>json({code,message:'Synthetic denied'},500));await assert.rejects(readPersonalPortrait(f.db,1,async()=>{loads++;return{memories:[],profile:emptyPersonalProfile,memoryEnabled:false};}));}assert.equal(loads,0);});
test('missing migration explicitly retains live portrait without claiming persistence',async()=>{
 const f=client(({path})=>path.includes('/rpc/luna4_portrait_epoch')?json({code:'PGRST202',message:'Missing optional RPC'},404):path.includes('/luna30_birth_profiles?')?json([]):path.includes('/luna_personal_profiles?')?json(null):json({message:'Unexpected request'},500));
 const result=await readPersonalPortrait(f.db,1,async()=>({memories:[],profile:emptyPersonalProfile,memoryEnabled:false}));assert.equal(result.persistence.state,'unavailable');assert.equal(result.birth.available,false);assert.ok(!f.calls.some(c=>c.path.includes('save_portrait')));
 await assert.rejects(createPortraitDiscussion(f.db,async()=>({memories:[],profile:emptyPersonalProfile,memoryEnabled:false})).open(1,{operationId:randomUUID(),section:'overview',language:'ru'}),error=>error instanceof Error&&'code'in error&&error.code==='portrait_migration_required');
});
