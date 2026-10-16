import {createHash,timingSafeEqual} from 'node:crypto';
export const luna32StagingSite='a634a7fc-1ecb-47fa-8b43-edd81a7e3694';
/** Ephemeral QA command credential. No production or public diagnostic route. */
export function authorizeLuna32Smoke(request:Request,siteId:string|undefined,options:{authSha256:string;expiresAt:string},now=Date.now()){
 if(request.method!=='POST'||siteId!==luna32StagingSite||!Number.isFinite(Date.parse(options.expiresAt))||now>=Date.parse(options.expiresAt)||!/^[a-f0-9]{64}$/.test(options.authSha256))return false;
 const auth=request.headers.get('authorization')??'';
 if(!/^Bearer [a-f0-9]{64}$/.test(auth))return false;
 const digest=createHash('sha256').update(auth.slice(7)).digest();
 return timingSafeEqual(digest,Buffer.from(options.authSha256,'hex'));
}
/** The canonical database intentionally keeps single-card fields separate. */
export function qaReadingCards(kind:'single'|'three'|'five',reading:{card_id?:unknown;orientation?:unknown;cards?:unknown}){
 const cards=kind==='single'?[{cardId:reading.card_id,orientation:reading.orientation}]:reading.cards;
 const expected=kind==='single'?1:kind==='three'?3:5;
 if(!Array.isArray(cards)||cards.length!==expected||cards.some(card=>!card||typeof card.cardId!=='string'||!card.cardId||!['upright','reversed'].includes(card.orientation))||new Set(cards.map(card=>card.cardId)).size!==expected)throw new Error('Invalid canonical saved reading');
 return cards as Array<{cardId:string;orientation:'upright'|'reversed'}>;
}
