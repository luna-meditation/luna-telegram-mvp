import {z} from 'zod';
import {billingMonthWindow} from './luna34-commercial-catalog.js';

/** Candidate terms for NEW orders only. Deliberately not imported into the
 * active invoice/wallet readers until the transactional release gates pass. */
export const luna4EconomyVersion='luna-4.0-completion-v1';
const quantity=z.number().int().min(0).max(10000),price=z.number().int().min(1).max(10000);
const allowance=z.object({standard:quantity,three:quantity,deep:quantity,premiumMeditations:z.boolean(),basicPortrait:z.boolean()}).strict();
export const luna4EconomySchema=z.object({
 version:z.literal(luna4EconomyVersion),currency:z.literal('XTR'),recurring:z.literal(false),
 premiumStars:z.object({weekly:z.literal(500),monthly:z.literal(1000),annual:z.literal(5000),lifetime:z.literal(10000)}).strict(),
 premiumAllowances:z.object({weekly:allowance,monthly:allowance,annual:allowance,lifetime:allowance}).strict(),
 packages:z.array(z.object({id:z.enum(['seeds_100','seeds_300','seeds_700','seeds_1500']),name:z.string().min(1).max(40),stars:price,seeds:price}).strict()).length(4),
 products:z.object({daily:price,single:price,three:price,five:price,deep:price,compatibility:price,portrait:price,aiMessages:z.object({seeds:price,quantity:quantity.refine(n=>n>0&&n<=100)}).strict()}).strict(),
 rewards:z.object({welcomeSeeds:quantity,introductoryMessages:quantity.refine(n=>n<=100),dailyCheckin:quantity,sevenDayStreak:quantity,referralInvitee:quantity,referralInviter:quantity,referralFirstPurchase:quantity}).strict()
}).strict().superRefine((value,ctx)=>{if(new Set(value.packages.map(p=>p.id)).size!==4)ctx.addIssue({code:'custom',path:['packages'],message:'Every package must have a unique stable product ID.'});});
export const luna4EconomyCandidate=luna4EconomySchema.parse({version:luna4EconomyVersion,currency:'XTR',recurring:false,
 premiumStars:{weekly:500,monthly:1000,annual:5000,lifetime:10000},
 premiumAllowances:{weekly:{standard:80,three:2,deep:0,premiumMeditations:true,basicPortrait:true},monthly:{standard:300,three:8,deep:1,premiumMeditations:true,basicPortrait:true},annual:{standard:300,three:8,deep:1,premiumMeditations:true,basicPortrait:true},lifetime:{standard:200,three:5,deep:1,premiumMeditations:true,basicPortrait:true}},
 packages:[{id:'seeds_100',name:'Starter',stars:100,seeds:100},{id:'seeds_300',name:'Explorer',stars:300,seeds:330},{id:'seeds_700',name:'Mystic',stars:700,seeds:800},{id:'seeds_1500',name:'Cosmic',stars:1500,seeds:1800}],
 // Existing non-daily single-card reading is retained, not silently removed.
 products:{daily:5,single:15,three:25,five:50,deep:100,compatibility:120,portrait:200,aiMessages:{seeds:50,quantity:20}},
 rewards:{welcomeSeeds:80,introductoryMessages:10,dailyCheckin:5,sevenDayStreak:10,referralInvitee:20,referralInviter:20,referralFirstPurchase:40}
});
export type Luna4Economy=z.infer<typeof luna4EconomySchema>;
export type Luna4Plan=keyof Luna4Economy['premiumAllowances'];

/** Snapshot included limits when the invoice is created. Later Admin edits
 * must not change an accepted invoice, a paid term, or its delivery. */
export function newPremiumContract(catalog:unknown,revision:number,plan:Luna4Plan){
 const value=luna4EconomySchema.parse(catalog);if(!Number.isSafeInteger(revision)||revision<0)throw Error('catalog_revision_required');
 if(!Object.prototype.hasOwnProperty.call(value.premiumAllowances,plan))throw Error('unknown_plan');
 return{catalogVersion:value.version,catalogRevision:revision,plan,stars:value.premiumStars[plan],recurring:false as const,allowances:structuredClone(value.premiumAllowances[plan]),allowanceScope:plan==='weekly'?'subscription_week' as const:'subscription_month' as const};
}
export function newPremiumWindow(plan:Luna4Plan,start:string,end:string|null,now:Date){
 const beginning=Date.parse(start),at=now.getTime(),ending=end===null?Infinity:Date.parse(end);
 if(!Number.isFinite(beginning)||!Number.isFinite(at)||Number.isNaN(ending)||at<beginning||at>=ending||plan!=='lifetime'&&!Number.isFinite(ending))throw Error('inactive_subscription');
 if(plan==='weekly'||plan==='monthly'){const endAt=Math.min(ending,beginning+(plan==='weekly'?7:30)*86400000);if(at>=endAt)throw Error('inactive_subscription');return{start:new Date(beginning).toISOString(),end:new Date(endAt).toISOString(),index:0};}
 // Billing-month anniversaries, not a reset at app launch or device midnight.
 return billingMonthWindow(start,end??'9999-12-31T23:59:59.000Z',now);
}

export type SeedProvenance={promotional:number;purchased:number;legacyUnclassified:number};
const checked=(value:number)=>{if(!Number.isSafeInteger(value)||value<0)throw Error('invalid_seed_provenance');return value;};
/** Accounting split for the existing server-side transaction, NOT a wallet.
 * Legacy unclassified value stays unclassified; never call it purchased. */
export function seedDebitProvenance(balance:SeedProvenance,amount:number){
 const p=checked(balance.promotional),b=checked(balance.purchased),u=checked(balance.legacyUnclassified);checked(amount);if(amount===0||!Number.isSafeInteger(p+b+u)||amount>p+b+u)throw Error('insufficient_seeds');
 const promotional=Math.min(p,amount),legacyUnclassified=Math.min(u,amount-promotional),purchased=amount-promotional-legacyUnclassified;
 return{promotional,purchased,legacyUnclassified};
}
/** Restoration uses the ORIGINAL debit split, never current reward rules. */
export function seedRefundProvenance(original:SeedProvenance){for(const value of Object.values(original))checked(value);return{...original};}

export function welcomeEligibility(input:{createdAt:string;cutoverAt:string;alreadyGranted:boolean;accountVerified:boolean}){
 const created=Date.parse(input.createdAt),cutover=Date.parse(input.cutoverAt);return Number.isFinite(created)&&Number.isFinite(cutover)&&created>=cutover&&!input.alreadyGranted&&input.accountVerified;
}
/** Fail closed: a UI and prices alone do not authorize paid delivery. */
export const luna4EconomyReleaseGates=['historical_invoice_replay','legacy_entitlement_preservation','promo_ledger_reconciliation','atomic_rewards','atomic_included_allowances','confirmed_daily_delivery','paid_portrait_delivery','compatibility_delivery','qualified_referrals','normal_chat_quality','interpretation_quality','refund_recovery','admin_audit','database_restore'] as const;
export function canActivateLuna4Economy(gates:Partial<Record<typeof luna4EconomyReleaseGates[number],boolean>>){return luna4EconomyReleaseGates.every(key=>gates[key]===true);}
