export type MessageBlock={kind:'paragraph'|'heading'|'unordered'|'ordered'|'separator'|'break';lines:string[]};
/** Text-only boundary for historical replies too. No HTML or model URLs execute. */
export function visibleMessageText(text:string,assistant=true,language='en'){
 if(!assistant)return text;
 let clean=text.trim();
 if(/^[\[{]|^```\s*json\b/i.test(clean)){
  try{const value=JSON.parse(clean.replace(/^```(?:json)?\s*|\s*```$/gi,''));clean=typeof value?.message==='string'?value.message:'';}catch{clean='';}
 }
 if(!clean||/"(?:detectedIntent|memoryCandidates)"\s*:/.test(clean))return language==='ru'?'Этот ответ не удалось отобразить. Продолжите разговор новым сообщением.':'This answer could not be displayed. Continue with a new message.';
 return clean.replace(/\\r\\n|\\n/g,'\n');
}
export function messageBlocks(text:string):MessageBlock[]{
 const blocks:MessageBlock[]=[];
 for(const line of text.split('\n')){
  const value=line.trim();if(!value){blocks.push({kind:'break',lines:[]});continue;}
  const kind=/^[-*_]{3,}$/.test(value)?'separator':/^#{1,4}\s/.test(value)?'heading':/^[-*•]\s/.test(value)?'unordered':/^\d+[.)]\s/.test(value)?'ordered':'paragraph';
  const content=value.replace(kind==='heading'?/^#{1,4}\s+/:kind==='unordered'?/^[-*•]\s+/:kind==='ordered'?/^\d+[.)]\s+/:/^$/,'');
  const last=blocks[blocks.length-1];
  if(last?.kind===kind&&kind!=='heading'&&kind!=='separator')last.lines.push(content);else blocks.push({kind,lines:kind==='separator'?[]:[content]});
 }
 return blocks.filter((b,i)=>b.kind!=='break'&&(b.kind!=='separator'||i>0&&i<blocks.length-1&&blocks[i-1]?.kind!=='separator')).flatMap(block=>{
  const text=block.lines.join('\n');
  if(block.kind!=='paragraph'||text.length<600||/[`*]/.test(text))return [block];
  const sentences=text.split(/(?<=[.!?])\s+/u),paragraphs:string[]=[];let current='';
  for(const sentence of sentences){if(current&&current.length+sentence.length>360){paragraphs.push(current);current='';}current+=(current?' ':'')+sentence;}
  if(current)paragraphs.push(current);
  return paragraphs.map(paragraph=>({kind:'paragraph' as const,lines:[paragraph]}));
 });
}
