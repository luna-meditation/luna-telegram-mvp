import {z} from 'zod';
export const cosmosDomainSchema=z.object({format:z.literal('luna42_domain'),status:z.string().trim().max(500),priority:z.string().trim().max(500),details:z.string().trim().max(500),goal:z.string().trim().max(500)}).strict();
export type CosmosDomain=z.infer<typeof cosmosDomainSchema>;
export function readCosmosDomain(value:string):CosmosDomain{
 try{const parsed=cosmosDomainSchema.safeParse(JSON.parse(value));if(parsed.success)return parsed.data;}catch{/* Existing plain-text entries remain intact. */}
 return {format:'luna42_domain',status:'',priority:'',details:value,goal:''};
}
export function writeCosmosDomain(input:unknown){
 const value=cosmosDomainSchema.parse(input),serialized=JSON.stringify(value);
 if(![value.status,value.priority,value.details,value.goal].some(v=>v.length>=2)||serialized.length>500)throw new Error('domain_too_long_or_empty');
 return serialized;
}
export function cosmosDomainSummary(value:string){const data=readCosmosDomain(value);return data.priority||data.status||data.goal||data.details;}
export function cosmosDomainContext(value:string){let data:CosmosDomain;try{data=cosmosDomainSchema.parse(JSON.parse(value));}catch{return value;}return [data.status&&`Current situation: ${data.status}`,data.priority&&`Priority: ${data.priority}`,data.details&&`User-provided details: ${data.details}`,data.goal&&`Goal: ${data.goal}`].filter(Boolean).join('\n');}
