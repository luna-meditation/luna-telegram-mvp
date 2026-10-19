/** Short-term conversation state, NOT a confirmed personal memory or permission
 * to run a purchase. Only validated, already-visible assistant questions enter. */
import {resolveIntelligenceCommand} from './luna-intelligence-command.js';
export type PersonalWorkflow={version:1;topic:string;question:string;context:string;options:Array<{id:string;label:string}>;updatedAt:string};
const clean=(v:unknown,n:number)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,n):'';
export function normalizePersonalWorkflow(raw:unknown,now=Date.now()):PersonalWorkflow|null{
 if(!raw||typeof raw!=='object')return null;const v=raw as Partial<PersonalWorkflow>;
 if(v.version!==1||!clean(v.question,500)||!v.updatedAt||!Number.isFinite(Date.parse(v.updatedAt))||Date.parse(v.updatedAt)>now+60000||now-Date.parse(v.updatedAt)>7*86400000)return null;
 return{version:1,topic:clean(v.topic,100),question:clean(v.question,500),context:clean(v.context,600),options:Array.isArray(v.options)?v.options.filter(o=>typeof o?.id==='string'&&typeof o.label==='string').slice(0,3).map((o,i)=>({id:'option-'+(i+1),label:clean(o.label,100)})):[],updatedAt:v.updatedAt};
}
export function personalWorkflowFromAnswer(content:string,options:string[],topic:string|null,now=new Date()):PersonalWorkflow|null{
 if(!Number.isFinite(now.getTime()))return null;
 const question=content.split(/(?<=[.!?])\s+|\n/u).filter(s=>s.includes('?')).at(-1)?.trim();
 if(!question||/(?:оплат|спис|купить|покупк|зв[её]зд|премиум|продлить|\b(?:purchase|charge|debit|buy|invoice|stars|premium|moon seeds)\b)/iu.test(question))return null;
 return{version:1,topic:/опрос|questionnaire|reflection exercise|коротк.{0,16}вопрос/iu.test(content)?'personal_discovery':topic??'reflection',question:clean(question,500),context:clean(content.replace(question,''),360),options:[...new Set(options)].slice(0,3).map((label,i)=>({id:'option-'+(i+1),label:clean(label,100)})),updatedAt:now.toISOString()};
}
export function personalWorkflowReply(message:string,current:unknown,suspended?:unknown){
 const returning=/(?:верн[её]мся|вернуться|продолжим|назад).{0,40}(?:опрос|вопрос|знакомств|обсужден)|(?:return|back|resume|continue).{0,35}(?:question|exercise|introduction|discussion)/iu.test(message);
 const workflow=returning?(normalizePersonalWorkflow(suspended)??normalizePersonalWorkflow(current)):normalizePersonalWorkflow(current);if(!workflow)return null;
 const normalized=message.toLocaleLowerCase().replace(/[.!?,]/g,'').trim();
 const accepted=/^(?:да|ага|хорошо|давай|опрос|начн[её]м|yes|yeah|okay|ok|let's|questionnaire|let’s do it)$/u.test(normalized),declined=/^(?:нет|не сейчас|пропустим|не хочу|no|not now|skip)$/u.test(normalized);
 const ordinal=/^(?:перв|первый вариант|один|1|first|option 1)/u.test(normalized)?0:/^(?:втор|два|2|second|option 2)/u.test(normalized)?1:/^(?:трет|три|3|third|option 3)/u.test(normalized)?2:-1;
 const option=ordinal>=0?workflow.options[ordinal]:workflow.options.find(o=>o.label.toLocaleLowerCase()===normalized);
 if(!returning&&!accepted&&!declined&&!option&&resolveIntelligenceCommand(message))return null;
 if(!returning&&!accepted&&!declined&&!option&&message.length>240)return null;
 return{version:1 as const,workflow,reply:declined?'declined':returning?'resume':accepted?'accepted':option?'selected':'free_text',...(option?{selectedOption:option}:{}),instructions:'This is the exact previous optional question, not a new request or stored fact. Answer first and continue this same topic. Accept free text; ask at most one useful next question. Do not restart a generic questionnaire, ask which survey, save personal data without confirmation, or authorize a financial action from this state.'};
}
/** Resolve a short reply against its current question for the existing bounded
 * memory selector. It does not authorize unrelated archives or financial work. */
export function personalContextQuery(message:string,reply:ReturnType<typeof personalWorkflowReply>){
 if(!reply||reply.reply==='declined'||reply.reply==='free_text'&&message.trim().split(/\s+/u).length>8)return message;
 return `${reply.workflow.question}\n${reply.selectedOption?.label??''}\n${message}`.slice(0,900);
}
export function personalWorkflowIdentity(value:PersonalWorkflow){
 let hash=2166136261;for(const char of value.question+'|'+value.updatedAt)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return 'workflow_'+(hash>>>0).toString(16);
}
export function validPersonalWorkflowChoice(workflow:PersonalWorkflow|undefined,choice:{id:string;option:string},message:string){
 return Boolean(workflow&&personalWorkflowIdentity(workflow)===choice.id&&workflow.options.some(item=>item.id===choice.option&&item.label===message.trim()));
}
