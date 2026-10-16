// Public synthetic reference dates only. No app user input and no paid service.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dates=['1990-Apr-15 12:00','2000-Jan-01 12:00','2020-Jun-15 12:00'];
const references=[];
for(const [body,command]of [['sun','10'],['moon','301'],['mars','499']]){
 const url=new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
 const options={format:'json',COMMAND:`'${command}'`,EPHEM_TYPE:"'OBSERVER'",CENTER:"'500@399'",QUANTITIES:"'31'",CSV_FORMAT:"'YES'",OBJ_DATA:"'NO'",MAKE_EPHEM:"'YES'",TIME_TYPE:"'UT'",TLIST:dates.map(d=>`'${d}'`).join(' '),TLIST_TYPE:"'CAL'"};
 for(const [k,v]of Object.entries(options))url.searchParams.set(k,v);
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('JPL reference request failed');
 const text=await response.text(),payload=JSON.parse(text);if(payload.error)throw new Error(payload.error);
 const block=payload.result.split('$$SOE')[1]?.split('$$EOE')[0];if(!block)throw new Error('Missing JPL ephemeris');
 const positions=block.trim().split('\n').map(line=>{const fields=line.split(',');return{utc:new Date(fields[0].trim()+' UTC').toISOString(),longitude:Number(fields[3])};});
 if(positions.length!==3||positions.some(p=>!Number.isFinite(p.longitude)))throw new Error('Invalid reference rows');
 references.push({body,url:url.toString(),responseSha256:createHash('sha256').update(text).digest('hex'),positions});
}
const directory=new URL('../test/fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
writeFileSync(new URL('jpl-horizons-reference.json',directory),JSON.stringify({source:'NASA/JPL Horizons DE441',retrievedAt:new Date().toISOString(),frame:'Geocentric apparent IAU76/80 ecliptic of date; quantity 31; UT',references},null,2)+'\n');
console.log('Prepared '+references.length*3+' public reference positions');
