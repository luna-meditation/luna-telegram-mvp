import {z} from 'zod';
export const discoveryDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const n=new Date(value+'T12:00:00Z');return Number.isFinite(n.getTime())&&n.toISOString().slice(0,10)===value&&value>='1800-01-01'&&value<='2100-12-31'&&value<=new Date().toISOString().slice(0,10);},'Use a valid birth date in the supported past interval.');
/** Only a complete unambiguous ISO or explicitly day-first dotted date.
 * A year/city, slash date or an arbitrary timestamp is never guessed. */
export function explicitBirthDate(text:string){
 const clean=text.trim(),pattern='(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\d{1,2}\\.\\d{4})';
 const match=clean.match(new RegExp('^'+pattern+'[.!]?$','u'))??clean.match(new RegExp('(?:I was born(?: on)?|my birth ?date is|я родил[а-яё]*|моя дата рождения|дата рождения)\\s*[:—-]?\\s*'+pattern+'(?=$|[\\s,.!?])','iu'));
 if(!match)return null;let date=match[1];if(date.includes('.')){const [d,m,y]=date.split('.');date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}
 return discoveryDate.safeParse(date).success?date:null;
}
