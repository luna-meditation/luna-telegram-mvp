import {readFileSync} from 'node:fs';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {FoundationError} from './foundation-error.js';
import type {EditorialKind,EditorialBody,EditorialEntry} from './luna42-editorial-contract.js';
export type {EditorialKind,EditorialBody,EditorialEntry} from './luna42-editorial-contract.js';
export const editorialKinds=['breathwork','tarot','astrology','garden','achievement','share','bot'] as const;
const text=(max:number)=>z.string().trim().min(1).max(max).refine(s=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(s),'Plain text only.');
const localized=(max:number)=>z.object({en:text(max),ru:text(max)}).strict();
const asset=z.string().max(2000);
const common={title:localized(120),description:localized(1500),image:asset.optional()};
const phase=z.enum(['inhale','inhale_top','hold','exhale','pause']);
const cue=z.object({url:asset,sha256:z.string().regex(/^[0-9a-f]{64}$/),durationSeconds:z.number().positive().lt(2),text:text(40).optional()}).strict();
const cues=z.object({inhale:cue,inhale_top:cue,hold:cue,exhale:cue,pause:cue}).strict();
const schemas={
 breathwork:z.object({...common,guide:localized(2000),phases:z.array(z.object({kind:phase,seconds:z.number().int().min(2).max(12)}).strict()).min(2).max(5),ambientAudio:asset,voiceCues:z.object({en:cues,ru:cues}).strict()}).strict(),
 tarot:z.object({...common,upright:localized(2000),reversed:localized(2000)}).strict(),
 astrology:z.object(common).strict(),garden:z.object(common).strict(),achievement:z.object(common).strict(),share:z.object({title:localized(24),description:localized(60)}).strict(),bot:z.object({...common,description:localized(900)}).strict()
};
export const editorialBaseline=JSON.parse(readFileSync(new URL('./luna42-editorial-baseline.json',import.meta.url),'utf8')) as EditorialEntry[];
const bundledAssets=new Set<string>(JSON.parse(readFileSync(new URL('./luna42-editorial-assets.json',import.meta.url),'utf8')));
export function editorialMedia(body:EditorialBody):string[]{return[...(body.image?[body.image]:[]),...(body.ambientAudio?[body.ambientAudio,...Object.values(body.voiceCues??{}).flatMap(lang=>Object.values(lang).map(c=>c.url))]:[])];}
export function parseEditorial(kind:EditorialKind,key:string,input:unknown,storageOrigin?:string,validateMedia=true):EditorialBody{
 const base=editorialBaseline.find(e=>e.kind===kind&&e.key===key);if(!base)throw new FoundationError(422,'unknown_content_key','Select an existing catalog entry. IDs and rules cannot be changed.');
 const body:EditorialBody=schemas[kind].parse(input);
 if(body.image&&!/\.(webp|png|jpe?g)$/.test(body.image)||body.ambientAudio&&!/\.mp3$/.test(body.ambientAudio))throw new FoundationError(422,'invalid_media_type','Choose an image or an MP3 for its matching field.');
 for(const path of validateMedia?editorialMedia(body):[]){
  if(bundledAssets.has(path))continue;
  let safe=false;try{const u=new URL(path);safe=Boolean(storageOrigin&&u.origin===new URL(storageOrigin).origin&&u.protocol==='https:'&&/^\/storage\/v1\/object\/public\/meditations\/admin40\/\d+\/[a-f0-9-]+\.(webp|png|jpg|mp3)$/.test(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password);}catch{/* Only exact known assets or authenticated uploads. */}
  if(!safe)throw new FoundationError(422,'unverified_media_origin','Use existing Luna artwork or an uploaded, verified media file.');
 }
 if(kind==='breathwork'&&body.phases&&base.body.phases&&body.voiceCues&&base.body.voiceCues){
  if(body.phases.map(p=>p.kind).join()!==base.body.phases.map(p=>p.kind).join()||body.phases.reduce((s,p)=>s+p.seconds,0)>60)throw new FoundationError(422,'invalid_breath_rhythm','Preserve the technique’s ordered phase types and a comfortable bounded rhythm.');
  // New voice recordings must have their own verified manifest; existing hashes
  // are immutable, not a checkbox allowing an unverified spoken cue.
  for(const lang of ['en','ru'] as const)for(const k of Object.keys(body.voiceCues[lang])as Array<keyof typeof cues.shape>){const value=body.voiceCues[lang][k],verified=Object.values(base.body.voiceCues[lang]).find(c=>c.url===value.url);if(!verified||value.sha256!==verified.sha256||value.durationSeconds!==verified.durationSeconds)throw new FoundationError(422,'cue_integrity_mismatch','Choose a verified voice clip and preserve its hash/duration. New recordings require asset verification before publication.');}
 }
 return body;
}
export async function readPublishedEditorial(db:SupabaseClient,storageOrigin?:string){
 const r=await db.from('luna42_published_editorial').select('kind,content_key,version,body');
 if(r.error)throw new FoundationError(503,'editorial_unavailable','Published content is temporarily unavailable; bundled content remains usable.');
 const entries:EditorialEntry[]=[];for(const row of r.data??[])try{const kind=z.enum(editorialKinds).parse(row.kind);entries.push({kind,key:row.content_key,version:row.version,body:parseEditorial(kind,row.content_key,row.body,storageOrigin)});}catch{/* Invalid historical content must never break practices or render active content. */}
 return entries;
}
export function applyAchievementEditorial<T extends {id:string;title:unknown;description:unknown;art:unknown}>(items:T[],entries:EditorialEntry[]):T[]{return items.map(item=>{const e=entries.find(e=>e.kind==='achievement'&&e.key===item.id);return e?{...item,title:e.body.title,description:e.body.description,art:e.body.image??item.art}:item;});}
