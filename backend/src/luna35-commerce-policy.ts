import {z} from 'zod';
export const commerceViews=['wallet','shop','premium','earn','history','quota','resume'] as const;
export type CommerceView=typeof commerceViews[number];
/** Conservative commands only: emotionally sensitive messages stay with the safety pipeline. */
export function commerceIntent(text:string):CommerceView|null{
 const clean=text.trim();if(clean.length>350||/suicid|kill myself|hurt myself|panic|abuse|lonely|одинок|самоуб|убить себя|паник|насили|боль в груди/i.test(clean))return null;
 if(/^(?:continue (?:my |the )?(?:previous |pending )?(?:reading|purchase|action)|продолж(?:и|ить) (?:предыдущий |прошлый |сохранённый )?(?:расклад|покупку|действие))[.!?]?$/i.test(clean))return 'resume';
 if(/(?:earn|free seeds|заработ|получить бесплатно).{0,45}(?:seeds|семен)|(?:seeds|семен).{0,45}(?:earn|заработ)/i.test(clean))return 'earn';
 if(/(?:transaction|payment history|purchase history|истори[яю] (?:покуп|платеж|баланс|транзакц))/i.test(clean))return 'history';
 if(/(?:how (?:many|much)|сколько|мой|my|show|покажи).{0,40}(?:balance|seeds|баланс|семян)|(?:wallet|кошел[её]к)/i.test(clean))return 'wallet';
 if(/(?:buy|purchase|купить|купи|покуп).{0,35}(?:seeds|семен)|(?:seeds shop|магазин seeds)/i.test(clean))return 'shop';
 if(/(?:premium|премиум|upgrade|подписк|тариф).{0,30}(?:cost|price|сколько|цен|куп|оформ|стоит)|^(?:how much is premium|сколько стоит premium|premium|премиум|i want to upgrade|хочу premium|хочу подписку)[.!?]?$/i.test(clean))return 'premium';
 if(/(?:quota|allowance|responses? left|лимит|квот|осталось ответов)/i.test(clean))return 'quota';
 return null;
}
export const pendingActionInput=z.object({id:z.string().uuid(),conversationId:z.string().uuid(),language:z.enum(['en','ru']),action:z.discriminatedUnion('type',[
 z.object({type:z.literal('tarot'),kind:z.enum(['single','three','five']),intention:z.enum(['general','love','career','growth']),question:z.string().trim().max(240),actionMessageId:z.string().uuid().optional(),choiceSlots:z.array(z.number().int().min(0).max(8)).min(1).max(5).refine(v=>new Set(v).size===v.length).optional()}).strict(),
 z.object({type:z.literal('compatibility'),chartId:z.string().uuid(),secondChartId:z.string().uuid()}).strict(),
 z.object({type:z.literal('natal'),chartId:z.string().uuid()}).strict()
])}).strict().superRefine((v,c)=>{if(v.action.type==='tarot'&&v.action.choiceSlots&&v.action.choiceSlots.length!==(v.action.kind==='single'?1:v.action.kind==='three'?3:5))c.addIssue({code:'custom',message:'Select the complete spread once.'});});
export type PendingActionInput=z.infer<typeof pendingActionInput>;
export type CommerceFacts={balance:number;paid:boolean;lifetime:boolean;beta:{active:boolean;features:readonly string[]};usage:{limit:number;remaining:number;resetAt:string};checkout:boolean;prices:{single:number;three:number;five:number;compatibility:number};included?:Partial<Record<'three'|'five'|'compatibility',number>>;paidReadings:boolean;knownOwned?:boolean};
/** Read-only eligibility. This is never authorization to debit a wallet. */
export function actionEligibility(facts:CommerceFacts,kind:'single'|'three'|'five'|'compatibility'){
 const feature=kind==='compatibility'?'astrology':'tarot';
 if(facts.knownOwned)return {allowed:true,source:'saved_result',required:0,shortfall:0};
 if(facts.beta.active&&facts.beta.features.includes(feature))return {allowed:true,source:'public_beta',required:0,shortfall:0};
 if(facts.lifetime)return {allowed:true,source:'legacy_lifetime',required:0,shortfall:0};
 if(facts.paid&&!facts.checkout)return {allowed:true,source:'existing_paid_rights',required:0,shortfall:0};
 if((facts.included?.[kind as 'three'|'five'|'compatibility']??0)>0)return {allowed:true,source:'included_allowance',required:0,shortfall:0};
 // A future catalog is not an active price. Do not put a paywall over today's flow.
 if(!facts.paidReadings)return {allowed:true,source:'existing_access',required:0,shortfall:0};
 const required=facts.prices[kind];return {allowed:facts.balance>=required,source:'moon_seeds',required,shortfall:Math.max(0,required-facts.balance)};
}
export function commerceText(view:CommerceView,language:'en'|'ru',facts:CommerceFacts){
 const en=language==='en';if(view==='quota')return en?`You have ${facts.usage.remaining} of ${facts.usage.limit} AI replies left. Your allowance resets at ${facts.usage.resetAt}. Saved conversations remain available.`:`Осталось ответов AI: ${facts.usage.remaining} из ${facts.usage.limit}. Квота обновится ${facts.usage.resetAt}. Сохранённые разговоры доступны.`;
 if(view==='wallet')return en?`You have ${facts.balance} Moon Seeds. Nothing is charged by opening your wallet.`:`У вас ${facts.balance} Moon Seeds. Просмотр баланса ничего не списывает.`;
 if(view==='shop')return facts.checkout?(en?'Choose a package. Telegram will ask you to confirm the exact Stars payment.':'Выберите пакет. Telegram попросит подтвердить точную сумму в Stars.'):(en?'Moon Seeds purchases are not available yet. Your current balance and access are unchanged.':'Покупки Moon Seeds пока недоступны. Текущий баланс и доступ не изменены.');
 if(view==='premium')return facts.lifetime?(en?'Lifetime Premium is already active. You do not need another subscription.':'Lifetime Premium уже активен. Новая подписка не нужна.'):facts.paid?(en?'Your paid Premium access is active. No duplicate subscription is needed.':'Ваш оплаченный Premium активен. Повторная подписка не нужна.'):facts.checkout?(en?'Choose your Premium term below. Each purchase is prepaid, without automatic renewal. Your current access is preserved.':'Выберите срок Premium ниже. Каждый тариф оплачивается один раз, без автопродления. Текущий доступ сохраняется.'):facts.beta.active?(en?'Your Public Beta access is active within the current quota.':'Public Beta активна в пределах текущей квоты.'):(en?'Purchases are not available yet. Your current rights are preserved.':'Покупки пока недоступны. Текущие права сохранены.');
 if(view==='earn')return en?'Choose a real practice. Rewards are checked after completion, never just for opening a page.':'Выберите практику. Награда проверяется после завершения, а не за открытие страницы.';
 if(view==='resume')return en?'Your saved action can be reopened below. No payment or AI generation happens until you explicitly continue.':'Сохранённое действие можно открыть ниже. Без вашего продолжения платежей и AI-генерации не будет.';
 return en?'Your verified balance and payment history. Pending payments do not grant access.':'Подтверждённая история баланса и платежей. Ожидающий платёж не даёт доступ.';
}
