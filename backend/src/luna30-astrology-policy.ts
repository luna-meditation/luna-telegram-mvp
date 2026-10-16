import {z} from 'zod';
import {birthCalculationInput} from './astrology-foundation.js';
import {resolveBirthLocation} from './luna30-locations.js';
export const birthProfileInput=z.object({subjectKind:z.enum(['self','other']),label:z.string().trim().min(1).max(80),date:z.string(),time:z.string().nullable(),placeId:z.string().min(1).max(50),consent:z.literal(true),revision:z.number().int().positive().optional()}).strict();
export function trustedBirthInput(raw:unknown,now=new Date()){
 const value=birthProfileInput.parse(raw);
 const calculation=birthCalculationInput.parse({date:value.date,time:value.time,location:resolveBirthLocation(value.placeId)});
 if(calculation.date<'1800-01-01'||calculation.date>now.toISOString().slice(0,10))throw new Error('Birth date must be in the past and after 1799.');
 return{value,calculation};
}
