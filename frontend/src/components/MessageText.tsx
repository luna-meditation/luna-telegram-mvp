import {messageBlocks,visibleMessageText} from './message-format';
function inline(text:string){return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part.startsWith('*')&&part.endsWith('*')?<em key={i}>{part.slice(1,-1)}</em>:part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:part);}
/** React escapes all text; no HTML parser, external links or heavy Markdown runtime. */
export function MessageText({text,assistant=true,language='en'}:{text:string;assistant?:boolean;language?:string}){
 const blocks=messageBlocks(visibleMessageText(text,assistant,language));
 const render=(items:typeof blocks)=>items.map((block,i)=>block.kind==='separator'?<hr key={i}/>:block.kind==='heading'?<h4 key={i}>{inline(block.lines.join(' '))}</h4>:block.kind==='unordered'?<ul key={i}>{block.lines.map((line,j)=><li key={j}>{inline(line)}</li>)}</ul>:block.kind==='ordered'?<ol key={i}>{block.lines.map((line,j)=><li key={j}>{inline(line)}</li>)}</ol>:<p key={i}>{inline(block.lines.join('\n'))}</p>);
 // Preserve complete historical/generated prose, never truncate in the middle
 // of an insight. Optional depth is a UI choice and makes no provider request.
 if(assistant&&text.length>1100&&blocks.length>2)return <>{render(blocks.slice(0,2))}<details className="luna43-depth"><summary>{language==='ru'?'Читать подробнее':'Read more'}</summary>{render(blocks.slice(2))}</details></>;
 return <>{render(blocks)}</>;
}
