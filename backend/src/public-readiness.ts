// Whitelisted deployment diagnostics: no keys, URLs with credentials, or user data.
const readinessFeatureKeys=['garden_atomic','personalization','ai_modes','tarot_history','tarot_ai'] as const;
export function publicRuntimeReadiness(input:{node:string;commit:string;supabaseUrl:string;model:string;aiEnabled:boolean;keyConfigured:boolean;flags:Partial<Record<typeof readinessFeatureKeys[number],boolean>>}){
 let projectRef:string|null=null;
 try{const url=new URL(input.supabaseUrl);if(url.protocol==='https:'&&!url.username&&!url.password)projectRef=url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1]??null;}catch{/* Do not return the original URL. */}
 const safeFlags=Object.fromEntries(readinessFeatureKeys.map(key=>[key,input.flags[key]===true]));
 return {
  node:/^\d+\.\d+\.\d+$/.test(input.node)?input.node:null,
  commit:/^[a-f0-9]{40}$/i.test(input.commit)?input.commit:null,
  projectRef,
  startupMigrations:'disabled-in-code',
  ai:{enabled:input.aiEnabled===true,model:/^gpt-[a-z0-9.-]{1,64}$/i.test(input.model)&&!input.model.toLowerCase().includes('sk-')?input.model:null,keyConfigured:input.keyConfigured===true},
  featureFlags:safeFlags
 };
}
