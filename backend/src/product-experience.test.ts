import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {conversationOpening,conversationEntryRows,guidedTopics,guidedDirection,isGuidedTopic} from './product-experience.js';
import {createCompanionEngine} from './companion-engine.js';
import {emptyPersonalProfile} from './personalization-policy.js';
import {buildPersonalPortrait} from './personal-portrait-policy.js';
import type {PersonalMemory} from './personal-memory-policy.js';

const entry={key:'a'.repeat(64),language:'ru' as const,greeting:'Привет.',reflection:{text:'Можно сделать план бережнее к себе.',basis:'Размышление, не прогноз.'},question:'Какой шаг будет посильным?',contextReflectionAllowed:false};
test('greeting, reflection and question have a stable order and IDs; dismissing never hides the question from AI',()=>{
 assert.deepEqual(conversationOpening(entry,'ru').map(row=>row.content),[entry.greeting,entry.reflection.text,entry.question]);
 assert.deepEqual(conversationOpening(entry,'ru'),conversationOpening(entry,'ru'));
 const rows=conversationEntryRows(entry,'ru',false,'work');assert.equal(rows.length,5);
 assert.equal(rows[1].excludeFromAi,true);assert.equal(rows[2].excludeFromAi,false);
 const dismissed=conversationEntryRows(entry,'ru',true);assert.equal(dismissed.length,2);assert.ok(dismissed.every(row=>!row.excludeFromAi));
 assert.equal(conversationEntryRows({...entry,contextReflectionAllowed:true},'ru')[1].excludeFromAi,false);
});
test('all four guided directions acknowledge a choice and ask one question without claiming personal history',()=>{
 for(const language of ['ru','en'] as const)for(const topic of guidedTopics){const d=guidedDirection(topic,language);assert.ok(d.acknowledgement.length>20);assert.equal((d.question.match(/\?/g)??[]).length,1);assert.equal(isGuidedTopic(topic),true);}
 for(const value of ['__proto__','purchase',null,{}])assert.equal(isGuidedTopic(value),false);
});
test('new and returning entry classification uses only an owner-filtered read and never creates messages',async()=>{
 let returning=false;const calls:string[]=[];
 const db=createClient('https://synthetic.invalid','synthetic-only',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));calls.push(url.toString());assert.equal(init?.method??'GET','GET');assert.equal(url.pathname,'/rest/v1/ai_messages');assert.equal(url.searchParams.get('telegram_id'),'eq.42');assert.equal(url.searchParams.get('role'),'eq.user');assert.equal(url.searchParams.get('limit'),'1');return Response.json(returning?[{id:randomUUID()}]:[]);
 }}});
 const engine=createCompanionEngine(db,async()=>({profile:{...emptyPersonalProfile,display_name:'UNCONSENTED_NAME'},memoryEnabled:false,memories:[]}));
 const input={operationId:randomUUID(),entryOnly:true,language:'en',timeZone:'Asia/Makassar'};
 const first=await engine.open(42,input);assert.equal(first.entry?.audience,'new');assert.equal(first.entry?.reflection,null);assert.ok(!first.entry?.greeting.includes('UNCONSENTED_NAME'));
 returning=true;const again=await engine.open(42,input);assert.equal(again.entry?.audience,'returning');assert.equal(first.entry?.key,again.entry?.key,'The first saved user turn cannot invalidate its own retry');
 assert.equal(calls.length,2);await assert.rejects(engine.open(0,input));
});
test('technical feedback events stay available to feedback infrastructure but do not become personal discoveries or history',()=>{
 const at=new Date().toISOString(),base={id:randomUUID(),category:'reflections',memory_key:'discovery_small_start',memory_value:'A small start helps me begin.',confirmation_status:'confirmed',memory_kind:'fact',is_sensitive:false,source_type:'user_entered',source_message_id:null,revision:1,created_at:at,updated_at:at,confirmed_at:at} as PersonalMemory;
 const result=buildPersonalPortrait({profile:{...emptyPersonalProfile,ai_context_consent:true},memories:[base,{...base,id:randomUUID(),memory_key:'luna_feedback_tarot_internal',memory_value:'{"choice":"not_me"}'}],memoryEnabled:true,hasBirth:false});
 assert.deepEqual(result.sections.discoveries.map(row=>row.id),[base.id]);assert.equal(result.timeline.length,1);
});
