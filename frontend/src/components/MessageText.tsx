/** A small text-only renderer. Never interprets HTML or creates model-supplied links. */
export function MessageText({text}:{text:string}){
 return <>{text.split(/\n\s*\n/).filter(Boolean).map((part,index)=>{
  const lines=part.trim().split('\n');
  if(lines.every(line=>/^[-*•] /.test(line)))return <ul key={index}>{lines.map((line,i)=><li key={i}>{line.replace(/^[-*•] /,'')}</li>)}</ul>;
  if(/^#{1,3} /.test(part)&&lines.length===1)return <h4 key={index}>{part.replace(/^#{1,3} /,'')}</h4>;
  return <p key={index}>{part.split(/(\*\*[^*]+\*\*)/g).map((text,i)=>text.startsWith('**')&&text.endsWith('**')?<strong key={i}>{text.slice(2,-2)}</strong>:text)}</p>;
 })}</>;
}
