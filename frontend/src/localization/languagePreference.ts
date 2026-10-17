export type LanguageMode='auto'|'en'|'ru';
export type LanguagePreference={mode:LanguageMode;revision:number;updatedAt:string|null};
export type LanguageSnapshot=LanguagePreference&{pending:boolean;syncError:boolean;legacy?:boolean};
export type LanguageStorage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;length?:number;key?:(index:number)=>string|null};
export const languagePreferenceKey=(owner:number)=>`luna.language.v2.${owner}`;
/** Adopt the old unscoped choice only when exactly one verified account cache
 * identifies its owner. Never carry another account's global preference over. */
export function ownedLegacyLanguage(storage:LanguageStorage|undefined,owner:number):'en'|'ru'|undefined{try{if(!storage?.key||storage.length===undefined)return;const accounts=Array.from({length:storage.length},(_,i)=>storage.key!(i)).filter(k=>k&&/^luna\.account\.\d+\.v1$/.test(k));if(accounts.length!==1||accounts[0]!==`luna.account.${owner}.v1`)return;const account=JSON.parse(storage.getItem(accounts[0]!)??'null');if(account?.access?.user?.telegram_id!==owner)return;const mode=storage.getItem('luna.language.v1');return mode==='en'||mode==='ru'?mode:undefined;}catch{return;}}
const valid=(v:unknown):v is LanguagePreference=>{const p=v as LanguagePreference|null;return Boolean(p&&['auto','en','ru'].includes(p.mode)&&Number.isSafeInteger(p.revision)&&p.revision>=0&&(p.updatedAt===null||typeof p.updatedAt==='string'));};
export function detectedLanguage(telegram?:string|null,browser?:string|null):'en'|'ru'{
 for(const candidate of [telegram,browser]){if(/^ru(?:[-_]|$)/i.test(candidate??''))return 'ru';if(/^en(?:[-_]|$)/i.test(candidate??''))return 'en';}return 'en';
}
/** Owner-scoped cache and serial CAS writes. A late read/ack cannot undo a tap.
 * Local choices remain pending across reloads when the network is unavailable. */
export function createLanguageController(input:{owner:number;storage?:LanguageStorage;legacyMode?:'en'|'ru';read:()=>Promise<LanguagePreference>;write:(value:{mode:LanguageMode;expectedRevision:number;requestId:string})=>Promise<LanguagePreference&{conflict?:boolean}>;uuid:()=>string}){
 let snapshot:LanguageSnapshot={mode:'auto',revision:0,updatedAt:null,pending:false,syncError:false};
 try{const cached=JSON.parse(input.storage?.getItem(languagePreferenceKey(input.owner))??'null');if(valid(cached))snapshot={...cached,pending:(cached as LanguageSnapshot).pending===true,syncError:false};else if(input.legacyMode)snapshot={...snapshot,mode:input.legacyMode,pending:true,legacy:true};}catch{/* Restricted storage is optional. */}
 let choice=0,inFlight:Promise<void>|null=null,requestId=input.uuid(),disposed=false;const listeners=new Set<()=>void>();
 const emit=()=>{if(disposed)return;try{input.storage?.setItem(languagePreferenceKey(input.owner),JSON.stringify(snapshot));}catch{/* In-memory intent remains authoritative. */}listeners.forEach(fn=>fn());};
 const flush=():Promise<void>=>{
  if(inFlight)return inFlight;
  if(!snapshot.pending||disposed)return Promise.resolve();
  inFlight=(async()=>{let conflicts=0;while(snapshot.pending&&!disposed){const sentChoice=choice,sentMode=snapshot.mode;try{
   const result=await input.write({mode:sentMode,expectedRevision:snapshot.revision,requestId});
   if(disposed)return;if(!valid(result)||result.revision<snapshot.revision)throw new Error('invalid_language_ack');
   snapshot={...snapshot,revision:result.revision,updatedAt:result.updatedAt,syncError:false};
   if(result.conflict){if(++conflicts>3)throw new Error('language_sync_conflict');requestId=input.uuid();emit();continue;}
   if(sentChoice===choice&&sentMode===snapshot.mode){snapshot={...snapshot,pending:false,legacy:false};}else requestId=input.uuid();emit();
  }catch{if(!disposed){snapshot={...snapshot,syncError:true};emit();}break;}}})().finally(()=>{inFlight=null;});return inFlight;
 };
 return {
  get:()=>snapshot,
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  async load(){const before=choice;try{const remote=await input.read();if(disposed||!valid(remote))return;
   if(before===choice&&(snapshot.legacy&&remote.revision>0||!snapshot.pending&&remote.revision>=snapshot.revision)){snapshot={...remote,pending:false,syncError:false};emit();}
   else if(snapshot.pending){snapshot={...snapshot,revision:Math.max(remote.revision,snapshot.revision)};emit();}
   await flush();
  }catch{if(!disposed){snapshot={...snapshot,syncError:true};emit();}}},
  choose(mode:LanguageMode){if(!['auto','en','ru'].includes(mode)||disposed)return;choice++;snapshot={...snapshot,mode,pending:true,syncError:false,legacy:false};requestId=input.uuid();emit();void flush();},
  retry:flush,
  dispose(){disposed=true;listeners.clear();}
 };
}
