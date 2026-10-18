/** Deterministic date-only Pythagorean numerology. Symbolic reflection, not a
 * scientific personality assessment. Raw birth dates never enter AI context. */
export const NUMEROLOGY_VERSION='pythagorean-date-1.0.0';
const masters=new Set([11,22,33]);
export function reduceNumber(value:number,preserveMasters=true):number{
 if(!Number.isSafeInteger(value)||value<1)throw new Error('positive_integer_required');
 while(value>9&&!(preserveMasters&&masters.has(value)))value=String(value).split('').reduce((sum,n)=>sum+Number(n),0);
 return value;
}
function dateParts(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('invalid_date');
 const parsed=new Date(value+'T12:00:00.000Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw new Error('invalid_date');
 const [year,month,day]=value.split('-').map(Number);
 if(year<1800||year>2200)throw new Error('unsupported_date');
 return{year,month,day};
}
export function calculateDateNumerology(birthDate:string,asOf:string){
 const birth=dateParts(birthDate),today=dateParts(asOf);
 if(birthDate>asOf)throw new Error('birth_date_in_future');
 const parts=[reduceNumber(birth.month),reduceNumber(birth.day),reduceNumber(birth.year)];
 const lifePath=reduceNumber(parts.reduce((sum,n)=>sum+n,0)),birthday=reduceNumber(birth.day);
 // Calendar periods are always 1–9, including years whose sum is 11/22/33.
 const personalYear=reduceNumber(birth.month+birth.day+reduceNumber(today.year,false),false);
 const personalMonth=reduceNumber(personalYear+today.month,false),personalDay=reduceNumber(personalMonth+today.day,false);
 return{version:NUMEROLOGY_VERSION,system:'pythagorean_date' as const,nature:'symbolic_not_scientific' as const,asOf,periodTimeZone:'UTC',lifePath,birthday,personalYear,personalMonth,personalDay,rules:{lifePath:'reduce month, day, year separately; sum and reduce; retain 11, 22, 33 at each stage',birthday:'reduce day; retain 11 and 22',periods:'calendar Jan–Dec; reduce month + day + current year to 1–9; add current month, then current day; no master numbers',nameBased:false}};
}
