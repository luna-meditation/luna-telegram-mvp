import test from 'node:test';
import assert from 'node:assert/strict';
import {meetStepPatch} from './luna42-meet.js';
import {buildIntelligenceInstructions} from './luna-intelligence-prompt.js';
import {randomUUID} from 'node:crypto';
import {focusedCompatibilityEvidence} from './luna30-astrology-chat-context.js';

test('pair context removes competing natal and repeated aspect lists without altering calculations or ownership',()=>{
 const first={subject:{label:'Synthetic A'},placements:{sun:'Capricorn'},aspects:[{from:'sun',to:'saturn',type:'trine'}]},second={subject:{label:'Synthetic B'},aspects:[]},synastry={aspects:[{from:'mars',to:'sun',type:'opposition'}]},source={reference:{id:'owned-comparison'},first,second,synastry,compatibilityReflection:{index:null,dimensions:[{id:'communication',score:null,evidence:[{from:'saturn',to:'mercury',type:'square'}]}]}};
 const result=focusedCompatibilityEvidence(source);assert.deepEqual(result.first.aspects,[]);assert.deepEqual(result.second.aspects,[]);assert.deepEqual(result.compatibilityReflection.dimensions[0].evidence,[]);assert.deepEqual(result.synastry,synastry);assert.deepEqual(result.reference,source.reference);assert.deepEqual(result.first.placements,first.placements);assert.equal(source.first.aspects.length,1);assert.equal(source.compatibilityReflection.dimensions[0].evidence.length,1);
 const natal={first};assert.equal(focusedCompatibilityEvidence(natal),natal);
});

test('written conversational interests replace enum selection only after explicit submission',()=>{
 const input={requestId:randomUUID(),expectedRevision:0,step:'interests',language:'ru',answer:'Фотография и разговорный английский'};
 const result=meetStepPatch(input);assert.equal(result.memory.key,'meet_interests');assert.equal(result.memory.value,input.answer);assert.deepEqual(result.profile.interests,[]);
 assert.deepEqual(meetStepPatch({...input,skip:true,answer:undefined}).profile,{});
 assert.deepEqual(meetStepPatch({...input,answer:['astrology','growth']}).profile.interests,['astrology']);
 assert.throws(()=>meetStepPatch({...input,answer:'x'}));
 assert.throws(()=>meetStepPatch({...input,step:'consent',answer:'maybe'}));
});
test('sensitive written onboarding details require a separate explicit decision',()=>{
 const input={requestId:randomUUID(),expectedRevision:1,step:'relationships',language:'en',answer:'My password is qwerty-123'};
 assert.throws(()=>meetStepPatch(input));assert.throws(()=>meetStepPatch({...input,sensitiveConsent:true}));
 const sensitive={...input,answer:'I take medication for my diagnosis'};assert.throws(()=>meetStepPatch(sensitive));assert.equal(meetStepPatch({...sensitive,sensitiveConsent:true}).memory.sensitive,true);
});
test('versioned Intelligence 3 policy keeps rollback and separates fact, note, source and action',()=>{
 for(const language of ['ru','en'] as const){const input={language,catalog:[],context:{active:null,personalContext:null},address:'Only the authorized name.'},old=buildIntelligenceInstructions(input),current=buildIntelligenceInstructions({...input,version:3});
 assert.match(old,/LUNA_INTELLIGENCE_V1/);assert.match(current,/LUNA_INTELLIGENCE_V3/);for(const text of ['latest topic wins','separate explicit confirmation','saved reflection or personal note','get_current_transits','get_date_numerology','memoryCandidates must stay empty','not a human'])assert.ok(current.includes(text),text);assert.ok(current.length<7500);assert.match(current,new RegExp(`CURRENT_RESPONSE_LANGUAGE=${language}`));assert.doesNotMatch(current,/INTELLIGENCE_2_RESPONSE_POLICY/);}
});
