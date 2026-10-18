import {z} from 'zod';
import {luna34CommercialCatalog} from './luna34-commercial-catalog.js';
export const seedProductCatalogSchema=z.object({
 aiMessages:z.object({seeds:z.number().int().min(1).max(10000),quantity:z.number().int().min(1).max(100),enabled:z.boolean()}).strict(),
 deepAnalysis:z.object({seeds:z.number().int().min(1).max(10000),enabled:z.boolean()}).strict()
}).strict();
export const luna43CommercialCatalog={...luna34CommercialCatalog,version:'luna-4.3',
 weekly:{stars:500,days:7,recurring:false},
 premium:{...luna34CommercialCatalog.premium,monthlyStars:1000,recurring:false},
 annual:{...luna34CommercialCatalog.annual,stars:5000},
 lifetime:{...luna34CommercialCatalog.lifetime,onSale:true,stars:10000},
 seedProducts:{aiMessages:{seeds:50,quantity:20,enabled:false},deepAnalysis:{seeds:100,enabled:false}}
} as const;
export type Luna43Catalog=Omit<typeof luna43CommercialCatalog,'seedProducts'>&{seedProducts:z.infer<typeof seedProductCatalogSchema>};
export function parseLuna43Catalog(value:unknown):Luna43Catalog{
 const parsed=z.object({seedProducts:seedProductCatalogSchema}).passthrough().parse(value);
 // Seed products are editable in Admin. New Stars prices are the owner's
 // explicit 4.3 approval; historical orders keep their stored price and term.
 const {seedProducts,...base}=parsed;
 const {seedProducts:_defaults,...expected}=luna43CommercialCatalog;void _defaults;
 const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
 if(canonical(base)!==canonical(expected))throw new Error('catalog_review_required');
 return{...luna43CommercialCatalog,seedProducts};
}
import {deepAnalysisTopics} from './luna-intelligence-deep-topics.js';
export {deepAnalysisTopics,deepTopicLabels} from './luna-intelligence-deep-topics.js';
export const seedPurchaseSchema=z.object({requestId:z.string().uuid(),product:z.enum(['ai_messages','deep_analysis']),expectedSeeds:z.number().int().positive(),catalogRevision:z.number().int().nonnegative(),confirmed:z.literal(true),language:z.enum(['en','ru']),topic:z.enum(deepAnalysisTopics).optional(),question:z.string().trim().max(500).optional(),chartId:z.string().uuid().optional(),personalContextConsent:z.literal(true).optional()}).strict();
export const deepAnalysisResultSchema=z.object({version:z.literal(1),summary:z.string().trim().min(30).max(900),sections:z.array(z.object({title:z.string().trim().min(2).max(90),insight:z.string().trim().min(20).max(1800),basis:z.array(z.string().trim().min(1).max(80)).min(1).max(6)}).strict()).min(2).max(5),takeaway:z.string().trim().min(10).max(600),question:z.string().trim().min(5).max(300),limitations:z.string().trim().min(10).max(500)}).strict();
