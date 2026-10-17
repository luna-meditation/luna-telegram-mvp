import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const shareExportSchema=z.object({kind:z.enum(['app','tarot','garden','achievement']),asset:z.string().max(180).optional(),format:z.enum(['story','square','portrait'])}).strict();
const ticketSchema=shareExportSchema.extend({owner:z.number().int().positive(),expires:z.number().int()}).strict();
export function issueShareExportTicket(secret:string,owner:number,body:unknown,now=Date.now()){
 const input=shareExportSchema.parse(body),payload=Buffer.from(JSON.stringify({...input,owner,expires:now+600000})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update('luna34-export:'+payload).digest('base64url');
}
export function verifyShareExportTicket(secret:string,owner:number,ticket:string,now=Date.now()){
 const parts=ticket.split('.');if(parts.length!==2||ticket.length>1200)throw new Error('Invalid export ticket');
 const expected=createHmac('sha256',secret).update('luna34-export:'+parts[0]).digest(),given=Buffer.from(parts[1],'base64url');
 if(given.length!==expected.length||!timingSafeEqual(given,expected))throw new Error('Invalid export signature');
 const value=ticketSchema.parse(JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')));
 if(value.owner!==owner||value.expires<now||value.expires>now+600000)throw new Error('Expired or foreign export');
 const hash=createHash('sha256').update(owner+':'+value.kind+':'+(value.asset??'app')).digest('hex');
 return {...value,entityId:`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`};
}
