/** Deterministic optional continuation, never a provider request on mount.
 * Only the existing owner-authorized conversation list is used, not guesses. */
export function intelligenceStarter(input:{language:'en'|'ru';name:string;now:number;lastShown:number;conversation?:{id:string;title:string;last_message_at?:string|null}}){
 const hour=new Date(input.now).getHours(),ru=input.language==='ru',name=input.name.trim().slice(0,60);
 const greeting=ru?`${hour<6?'Доброй ночи':hour<12?'Доброе утро':hour<18?'Добрый день':'Добрый вечер'}${name?', '+name:''}.`: `${hour<6?'A quiet moment':hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'}${name?', '+name:''}.`;
 const c=input.conversation,age=c?.last_message_at?input.now-Date.parse(c.last_message_at):Infinity;
 const continuation=c&&age>=0&&age<7*86400000&&input.now-input.lastShown>=86400000&&c.title.trim()?{id:c.id,label:ru?'Продолжить прошлый разговор':'Continue our last conversation',title:c.title.replace(/\s+/g,' ').slice(0,60)}:null;
 return{greeting,continuation};
}
