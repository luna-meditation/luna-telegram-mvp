/** Provider-side short-answer shapes for verified numeric or saved artifacts.
 * No arithmetic, permission change, prose truncation, or second AI call. */
export const numerologyOverviewPattern='^[\\s\\S]{1,1200}$';
export function requestedNumerologyIndicators(request:string){
 const keys:Array<'lifePath'|'birthday'|'personalYear'|'personalMonth'|'personalDay'>=[];
 if(/life[ -]?path|жизненн\p{L}*.{0,12}пут|числ\p{L}*.{0,10}пути/iu.test(request))keys.push('lifePath');
 if(/birthday|числ\p{L}*.{0,12}(?:рожд|дня)/iu.test(request))keys.push('birthday');
 if(/personal[ -]?year|личн\p{L}*.{0,12}(?:год|года)/iu.test(request))keys.push('personalYear');
 if(/personal[ -]?month|личн\p{L}*.{0,12}месяц/iu.test(request))keys.push('personalMonth');
 if(/personal[ -]?day|личн\p{L}*.{0,12}(?:день|дня)/iu.test(request))keys.push('personalDay');
 return keys.length?keys:['lifePath','personalYear'] as const;
}
/** Keep the full deterministic result for validation/UI; send only the
 * requested numeric indicators to the prose step. No new calculation. */
export function scopedNumerologyEvidence<T>(facts:T,request:string):T{
 if(!facts||typeof facts!=='object'||(facts as {system?:unknown}).system!=='pythagorean_date')return facts;
 const chosen=new Set<string>(requestedNumerologyIndicators(request));return Object.fromEntries(Object.entries(facts).filter(([key])=>!['lifePath','birthday','personalYear','personalMonth','personalDay'].includes(key)||chosen.has(key))) as T;
}
export function detailedNumerologyRequested(request:string){return /master|мастер|method|метод|step.by.step|пошаг|how.{0,20}calcul|как.{0,20}(?:счит|рассчит)|in detail|подроб|deep analysis|глубокий разбор/iu.test(request);}
function constrainMessage<T extends Record<string,unknown>>(body:T,contract:string):T{
 const text=body.text as {format?:{schema?:{properties?:Record<string,unknown>}}}|undefined,schema=text?.format?.schema,message=schema?.properties?.message as Record<string,unknown>|undefined;
 if(!message||message.type!=='string')throw new Error('numerology_response_contract_required');
 const existing=typeof body.max_output_tokens==='number'?body.max_output_tokens:950,effort=(body.reasoning as {effort?:string}|undefined)?.effort;
 // Higher reasoning efforts need their existing hidden-token budget. Bound
 // visible prose with the schema, not by cutting a verified answer mid-output.
 const budget=effort&&!['none','minimal'].includes(effort)?existing:Math.min(existing,950);
 return {...body,max_output_tokens:budget,instructions:String(body.instructions??'')+'\n'+contract,text:{...text,format:{...text!.format,schema:{...schema,properties:{...schema!.properties,message:{...message,pattern:numerologyOverviewPattern}}}}}} as T;
}
export function conciseNumerologyRequest<T extends Record<string,unknown>>(body:T,request:string):T{
 if(detailedNumerologyRequested(request))return body;
 return constrainMessage(body,'NUMEROLOGY_OVERVIEW_CONTRACT: The verified numeric evidence is already available. Requested indicator fields: '+requestedNumerologyIndicators(request).join(', ')+'. Omit every other indicator, even if old context mentioned it. Give 80–130 words in 2–3 short paragraphs, inside the message field\'s 1200-character bound. Explain only the requested indicators, with one optional practical experiment. A calendar personal year is January–December, not the next twelve months from today. Numbers are symbolic editorial conventions, not proven skills, habits, character traits or forecasts. Interests and goals are not evidence of an existing routine. One short symbolic-not-scientific disclosure; no method lecture or promised events. Do not repeat content to fill space.');
}
export function conciseArtifactRequest<T extends Record<string,unknown>>(body:T):T{return constrainMessage(body,'SELECTED_ARTIFACT_SHORT_ANSWER: Answer the current narrow question in 80–130 words, 2–3 short paragraphs inside the 1200-character message bound. Use at most two exact supplied factors. Do not reprint the whole saved report. Interpretations are possible symbolic reflections, never established personal traits. Interests and goals do not prove an existing habit or skill. At most one relevant question; no technical dump, repeated disclaimer or button list in message. The saved original result remains unchanged.');}

/** Bound ordinary companion prose at generation time, without trimming a
 * finished answer or changing its model, reasoning or output-token budget. */
export function conciseCompanionRequest<T extends Record<string,unknown>>(body:T):T{
 const text=body.text as {format?:{schema?:{properties?:Record<string,unknown>}}}|undefined,schema=text?.format?.schema,message=schema?.properties?.message as Record<string,unknown>|undefined;
 if(!message||message.type!=='string')throw new Error('companion_response_contract_required');
 return {...body,instructions:String(body.instructions??'')+'\nTHIS_COMPANION_TURN: Reply to the latest situation in 2–5 sentences, usually 50–90 words, inside the 1100-character message bound. Show one specific understanding grounded in the user’s actual words. Ask at most one useful question or give one requested next step. Do not impose a plan, infer personality from an availability flag, offer business deliverables, repeat onboarding, or list reply buttons in prose. quickReplies are plausible answers the USER could choose to your exact question, not tasks you offer. No generic reassurance or invented personal details.',text:{...text,format:{...text!.format,schema:{...schema,properties:{...schema!.properties,message:{...message,pattern:'^[\\s\\S]{1,1100}$'}}}}}} as T;
}
