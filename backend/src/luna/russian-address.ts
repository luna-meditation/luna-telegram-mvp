/** Grammatical preference is explicit user input, never inferred from identity. */
type Address='masculine'|'feminine'|'neutral';
export function explicitRussianAddress(context:unknown,currentMessage=''):Address|null{
 const p=context&&typeof context==='object'?context as {preferences?:unknown;confirmedMemories?:Array<{key:string;value:string}>}:null;
 const explicitRequest=/(?:(?:не|not)\s+)?(?:обращайся|обращаться|говори|пиши|обращение|address me|refer to me)[^.!?\n]{0,70}/giu;
 const current=[...currentMessage.matchAll(explicitRequest)].map(m=>m[0]);
 const entries:string[]=[];
 if(typeof p?.preferences==='string')entries.push(p.preferences);
 for(const memory of Array.isArray(p?.confirmedMemories)?p.confirmedMemories:[])if(memory&&typeof memory.key==='string'&&typeof memory.value==='string'&&/^(?:pronouns|grammatical[_ ]address|gender|род|местоимения|предпочитаемое[_ ]обращение)$/iu.test(memory.key))entries.push(memory.value);
 const parse=(value:string):Address|null=>{
  if(/(?:нейтральн|neutral|без рода|не используй.*(?:мужск|женск)|не обращайся)/iu.test(value))return 'neutral';
  const male=/(?:мужском роде|мужской род|masculine|he\/him)|^(?:male|мужчина|мужской)$/iu.test(value),female=/(?:женском роде|женский род|feminine|she\/her)|^(?:female|женщина|женский)$/iu.test(value);
  return male===female?null:male?'masculine':'feminine';
 };
 const requested=current.map(parse).filter((v):v is Address=>v!==null);
 if(requested.length)return new Set(requested).size===1?requested[0]:null;
 const values=entries.map(parse).filter((v):v is Address=>v!==null);
 return values.length&&new Set(values).size===1?values[0]:null;
}
export function russianAddressInstructions(language:'en'|'ru',context:unknown,currentMessage=''){
 if(language!=='ru')return '';
 const preference=explicitRussianAddress(context,currentMessage);
 return `RUSSIAN ADDRESS CHECK: Luna's own feminine voice does NOT establish the user's gender. ${preference?`The user explicitly requests ${preference} grammatical address; respect it.`:'No explicit grammatical preference is available. Address the user gender-neutrally, regardless of name, photo or older assistant wording.'} Prefer present/future tense and impersonal constructions. Say "Хочешь продолжить?", not "Ты готова/готов?"; "Что удалось заметить?", not "Что ты заметила/заметил?"; "Можно попробовать", not "Ты могла/мог бы". Never invent a diminutive. Do not silently save a gender preference.`;
}
/** Narrow, deterministic repair of common unsupported second-person forms.
 * Does not rewrite first-person Luna speech, third-party descriptions or names.
 * No extra provider request and no change to saved personal data.
 */
export function neutralRussianAddress(text:string,language:'en'|'ru',context:unknown,currentMessage=''){
 if(language!=='ru'||['masculine','feminine'].includes(explicitRussianAddress(context,currentMessage)??''))return text;
 return text
  .replace(/(^|[\s«"(])([Тт]ы)\s+готов(?:а)?(?=[\s?!.:,»")]|$)/gu,(_,prefix,pronoun)=>`${prefix}${pronoun} хочешь`)
  .replace(/(^|[\s«"(])([Гг])отов(?:а)?\s+(?=(?:продолжить|обсудить|попробовать|начать|сделать)(?:[\s?!.:,]|$))/gu,(_,prefix,capital)=>`${prefix}${capital==='Г'?'Хочешь':'хочешь'} `)
  .replace(/([Тт]ы)\s+мог(?:ла)?\s+бы/gu,'$1 можешь')
  .replace(/([Тт]ы)\s+заметил(?:а)?(?=[\s?!.:,]|$)/gu,(_,pronoun)=>`${pronoun==='Ты'?'Тебе':'тебе'} удалось заметить`)
  .replace(/([Тт]ы)\s+выбрал(?:а)?(?=[\s?!.:,]|$)/gu,(_,pronoun)=>`${pronoun==='Ты'?'Тебе':'тебе'} удалось выбрать`);
}
export function neutralRussianInterpretation<T>(value:T,language:'en'|'ru',context:unknown,currentMessage=''):T{
 if(typeof value==='string')return neutralRussianAddress(value,language,context,currentMessage) as T;
 if(Array.isArray(value))return value.map(v=>neutralRussianInterpretation(v,language,context,currentMessage)) as T;
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,neutralRussianInterpretation(v,language,context,currentMessage)])) as T;
 return value;
}
