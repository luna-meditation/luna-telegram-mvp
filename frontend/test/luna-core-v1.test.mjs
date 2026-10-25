import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const source=readFileSync('src/components/LunaChat.tsx','utf8');
const body=source.slice(source.indexOf('function errorDetails('),source.indexOf('export function recommendationIdForMessage')).replace('function errorDetails(','export function errorDetails(');
const compiled=ts.transpileModule('export class ApiRequestError extends Error {constructor(code:string){super(code);this.status=409;this.responseBody=JSON.stringify({code});}}\n'+body,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const {errorDetails,ApiRequestError}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const language of ['ru','en'])test(`stale/unverified chart recovery is localized and does not offer a blind retry (${language})`,()=>{
 for(const code of ['chart_source_changed','unsupported_chart_version','chart_source_unverified']){const result=errorDetails(new ApiRequestError(code),language);assert.equal(result.retryable,false);assert.equal(result.state,'failed_non_retryable');assert.match(result.message,language==='ru'?/пересчитай карту/:/recalculate/);assert.match(result.message,language==='ru'?/истории/:/history/);}
});
