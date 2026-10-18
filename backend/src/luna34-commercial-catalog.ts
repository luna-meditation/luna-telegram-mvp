/** Authoritative proposed commercial catalog. Activation is separate from code.
 * No frontend may grant rights, set prices or infer Stars → cash revenue. */
export const luna34CommercialCatalog={
 version:'luna-3.4',currency:'XTR',
 free:{aiSuccessfulRepliesPerUtcDay:5,meditations:3,dailyCard:1},
 premium:{monthlyStars:500,periodDays:30,ordinaryAiRepliesPerBillingMonth:300,meditations:8,threeCardReadings:8,fiveCardReadings:4,compatibilityReports:2,renewalSeeds:100},
 annual:{stars:3500,days:365,recurring:false,allocation:'monthly_anniversary'},
 lifetime:{onSale:false,policy:'preserve_legacy',ordinaryAllowance:'existing_daily_quota',allPromisedContent:true},
 seeds:{single:15,three:40,five:70,compatibility:100},
 packages:[{id:'seeds_100',seeds:100,stars:100},{id:'seeds_300',seeds:300,stars:270},{id:'seeds_700',seeds:700,stars:590},{id:'seeds_1500',seeds:1500,stars:1190}],
 ordinaryRewards:{meditation:3,breath:2,journal:1,dailyCap:6,sevenDays:10},
 referrals:{inviter:30,newUser:20,maxMonthly:5},supportStars:[10,50,100,500],
 achievementRewardsEnabled:false
} as const;
export type MembershipKind='free'|'weekly'|'monthly'|'annual'|'lifetime'|'legacy_fixed_term';
const valid=(date:string|null|undefined)=>{const value=Date.parse(date??'');return Number.isFinite(value)?value:null;};
/** UTC anniversary windows, clamped at month-end and inside the paid term.
 * Annual access allocates only the current month; never 12 months up front. */
export function billingMonthWindow(startIso:string,endIso:string,now=new Date()){
 const start=valid(startIso),end=valid(endIso),at=now.getTime();if(start===null||end===null||start>=end||at<start||at>=end)throw new Error('inactive_billing_period');
 const anchor=new Date(start),monthOffset=(now.getUTCFullYear()-anchor.getUTCFullYear())*12+now.getUTCMonth()-anchor.getUTCMonth();
 const anniversary=(offset:number)=>{const target=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+offset,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();return Date.UTC(target.getUTCFullYear(),target.getUTCMonth(),Math.min(anchor.getUTCDate(),last),anchor.getUTCHours(),anchor.getUTCMinutes(),anchor.getUTCSeconds(),anchor.getUTCMilliseconds());};
 const offset=anniversary(monthOffset)>at?monthOffset-1:monthOffset;
 return {start:new Date(Math.max(start,anniversary(offset))).toISOString(),end:new Date(Math.min(end,anniversary(offset+1))).toISOString(),index:offset};
}
export function resolveMembership(input:{lifetime:boolean;legacyUntil?:string|null;period?:{start:string;end:string;days:7|30|365}|null},now=new Date()){
 // Existing promises always take precedence over newly introduced quotas.
 if(input.lifetime)return {kind:'lifetime' as MembershipKind,paid:true,until:null,preserveLegacy:true,ordinaryLimit:null,resetAt:null};
 if((valid(input.legacyUntil)??0)>now.getTime())return {kind:'legacy_fixed_term' as MembershipKind,paid:true,until:input.legacyUntil!,preserveLegacy:true,ordinaryLimit:null,resetAt:null};
 const period=input.period,paidStart=valid(period?.start),paidEnd=valid(period?.end);if(period&&paidStart!==null&&paidEnd!==null&&paidStart<=now.getTime()&&paidEnd>now.getTime()){
  const window=period.days===365?billingMonthWindow(period.start,period.end,now):{start:period.start,end:period.end,index:0};
  return {kind:(period.days===365?'annual':period.days===7?'weekly':'monthly') as MembershipKind,paid:true,until:period.end,preserveLegacy:false,ordinaryLimit:period.days===7?null:300,resetAt:window.end,window};
 }
 const start=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());return {kind:'free' as MembershipKind,paid:false,until:null,preserveLegacy:false,ordinaryLimit:5,resetAt:new Date(start+86400000).toISOString(),window:{start:new Date(start).toISOString(),end:new Date(start+86400000).toISOString(),index:0}};
}
