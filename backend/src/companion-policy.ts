import {z} from 'zod';
import type {PersonalMemory} from './personal-memory-policy.js';
export const companionSettingsKey='companion_settings';
export const companionPreferences=z.object({version:z.literal(1),inAppFollowUps:z.boolean()}).strict();
export function companionPreference(rows:PersonalMemory[]){const row=rows.find(m=>m.memory_key===companionSettingsKey&&m.confirmation_status==='confirmed');if(!row)return{version:1 as const,inAppFollowUps:true};try{return companionPreferences.parse(JSON.parse(row.memory_value));}catch{return{version:1 as const,inAppFollowUps:false};}}
