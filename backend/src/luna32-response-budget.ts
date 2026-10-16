/** Structured output includes JSON and reasoning tokens, not just visible prose. */
export function responseTokenBudget(input:{ordinary:number;structured:number;hasArtifact:boolean;detailed:boolean;guided:boolean}){
 const cap=(value:number)=>Math.max(512,Math.min(8192,Math.floor(value)));
 if(input.hasArtifact||input.detailed||input.guided)return cap(Math.max(input.ordinary,input.structured));
 return cap(input.ordinary);
}

/** Diagnostics contain only validation paths/codes, never rejected values. */
export function safeValidationIssues(error:unknown){
 const issues=(error as {issues?:Array<{code?:unknown;path?:unknown[]}>})?.issues;
 return (issues??[]).slice(0,8).map(issue=>({code:typeof issue.code==='string'?issue.code:'invalid',path:(issue.path??[]).filter(p=>typeof p==='string'||typeof p==='number').slice(0,5).join('.')}));
}
