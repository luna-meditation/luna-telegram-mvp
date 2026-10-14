import {z} from 'zod';
export const personalInterests=['tarot','astrology','wellbeing','meditation'] as const;
const optionalText=(maximum:number)=>z.string().trim().max(maximum).nullable().transform(value=>value||null);
export const personalProfileSchema=z.object({
 display_name:z.string().trim().max(60).nullable().default(null).transform(value=>value||null),
 interests:z.array(z.enum(personalInterests)).max(4).transform(value=>[...new Set(value)]),
 preferences:z.string().trim().max(500),
 birth_date:optionalText(10).refine(value=>!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value&&value<=new Date().toISOString().slice(0,10))),
 birth_time:optionalText(5).refine(value=>!value||/^([01]\d|2[0-3]):[0-5]\d$/.test(value)),
 birth_place:optionalText(120),
 ai_context_consent:z.boolean()
}).strict();
export type PersonalProfile=z.infer<typeof personalProfileSchema>;
export const emptyPersonalProfile:PersonalProfile={display_name:null,interests:[],preferences:'',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:false};
export function permittedPersonalContext(profile:PersonalProfile|null){
 if(!profile?.ai_context_consent)return null;
 return {displayName:profile.display_name,interests:profile.interests,preferences:profile.preferences.slice(0,500)};
}
