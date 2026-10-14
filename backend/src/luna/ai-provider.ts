import{env}from'../config.js';
/** Shared server-only transport. No implicit retries or frontend credentials. */
export function requestLunaResponse(body:unknown,signal:AbortSignal){
 if(!env.OPENAI_API_KEY)throw new Error('AI provider is not configured.');
 return fetch('https://api.openai.com/v1/responses',{method:'POST',signal,headers:{'content-type':'application/json',authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify(body)});
}
export function responseOutputText(response:unknown){
 const value=response as {status?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>};
 if(value.status!=='completed')return null;
 const texts=value.output?.flatMap(item=>item.content??[]).filter(item=>item.type==='output_text').map(item=>item.text??'');
 return texts?.length?texts.join('\n'):null;
}
