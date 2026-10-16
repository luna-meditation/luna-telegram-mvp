import {createHash} from 'node:crypto';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
/** Ignore only the expected last-sync timestamp, not balances or ownership. */
export function protectedStateFingerprint(user,gardens){
 const stable=gardens.map(({updated_at:_lastSync,...garden})=>garden);
 return createHash('sha256').update(JSON.stringify(canonical({user,gardens:stable}))).digest('hex');
}
