import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import {containsCredential,potentiallySensitive} from './personal-memory-policy.js';
import {meetSteps,meetInterestOptions,meetOptions} from './luna42-meet-config.js';
export const meetStepInput=z.object({requestId:z.string().uuid(),expectedRevision:z.number().int().min(0),step:z.enum(meetSteps),skip:z.boolean().default(false),language:z.enum(['en','ru']),answer:z.union([z.string().trim().max(500),z.array(z.string().max(40)).max(9),z.boolean()]).optional(),sensitiveConsent:z.boolean().default(false)}).strict();
export function meetStepPatch(raw:unknown){
 const v=meetStepInput.parse(raw),profile:Record<string,unknown>={},memory:Record<string,unknown>={};
 if(v.skip){if(v.answer!==undefined)throw new FoundationError(422,'invalid_meet_answer','A skipped question has no answer.');return{input:v,profile,memory};}
 const put=(key:string,category:string,value:string)=>{if(!value.trim()||containsCredential(value))throw new FoundationError(422,'invalid_meet_answer','Check this answer. Do not save credentials.');const sensitive=potentiallySensitive(value);if(sensitive&&!v.sensitiveConsent)throw new FoundationError(422,'sensitive_consent_required','Choose separately whether to store sensitive information.');Object.assign(memory,{key,category,value,sensitive:sensitive||v.sensitiveConsent});};
 if(v.step==='name'){if(typeof v.answer!=='string'||!v.answer||v.answer.length>60||containsCredential(v.answer))throw new FoundationError(422,'invalid_meet_answer','Choose a name up to 60 characters.');profile.display_name=v.answer;}
 else if(v.step==='interests'){if(!Array.isArray(v.answer)||!v.answer.length||v.answer.some(id=>!meetInterestOptions.some(o=>o[0]===id)))throw new FoundationError(422,'invalid_meet_answer','Select your interests.');const ids=[...new Set(v.answer)];profile.interests=ids.filter(id=>['tarot','astrology','wellbeing','meditation'].includes(id));put('meet_interests','interests',JSON.stringify(ids));}
 else if(v.step==='consent'){if(typeof v.answer!=='boolean')throw new FoundationError(422,'explicit_consent_required','Choose whether to personalize.');profile.ai_context_consent=v.answer;}
 else if(v.step==='birth'){if(v.answer!=='later'&&v.answer!=='connected')throw new FoundationError(422,'invalid_meet_answer','Use the existing birth-profile editor.');}
 else{if(typeof v.answer!=='string'||!v.answer)throw new FoundationError(422,'invalid_meet_answer','Choose or write an answer.');const option=meetOptions[v.step].find(o=>o[0]===v.answer);const value=option?option[v.language==='en'?1:2]:v.answer;put(v.step==='relationships'?'cosmos_relationships':v.step==='style'?'communication_style':'meet_priority',v.step==='relationships'?'life_context':v.step==='style'?'preferences':'goals',value);}
 return {input:v,profile,memory};
}
export function createMeetLunaService(db:SupabaseClient){return{
 async get(owner:number){const r=await db.from('luna41_cosmos_onboarding').select('meet_state,revision,updated_at').eq('telegram_id',owner).maybeSingle();if(r.error)throw new FoundationError(503,'meet_unavailable','Your introduction could not load.');return{meet:r.data?.meet_state??{},revision:r.data?.revision??0,updatedAt:r.data?.updated_at??null};},
 async save(owner:number,raw:unknown){const {input:v,profile,memory}=meetStepPatch(raw);if(v.step==='birth'&&v.answer==='connected'){const check=await db.from('luna30_birth_profiles').select('id').eq('telegram_id',owner).eq('subject_kind','self').limit(1).maybeSingle();if(check.error||!check.data)throw new FoundationError(422,'birth_profile_required','Save your own birth profile first.');}
  const hash=createHash('sha256').update(JSON.stringify({step:v.step,skip:v.skip,profile,memory})).digest('hex');const r=await db.rpc('luna42_save_meet_step',{p_owner:owner,p_request:v.requestId,p_expected:v.expectedRevision,p_step:v.step,p_skip:v.skip,p_hash:hash,p_profile:profile,p_memory:memory});if(r.error||!r.data)throw new FoundationError(r.error?.code==='40001'||r.error?.code==='23514'?409:503,r.error?.code==='40001'?'meet_changed':'meet_unavailable','Your answer could not be saved. Reopen the introduction before continuing.');return r.data;
 }
};}
