import assert from 'node:assert/strict';
import {test} from 'node:test';
import {publicRuntimeReadiness} from './public-readiness.js';
test('public rollout diagnostics whitelist metadata and cannot expose secrets or credential-bearing URLs',()=>{
 const input={node:'22.23.3',commit:'a'.repeat(40),supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',model:'gpt-5-mini',aiEnabled:true,keyConfigured:true,flags:{personalization:false,tarot_ai:true,unrelated_secret:true}};
 const good=publicRuntimeReadiness(input);assert.equal(good.projectRef,'abcdefghijklmnopqrst');assert.equal(good.commit,input.commit);assert.equal(good.ai.model,'gpt-5-mini');assert.equal(good.startupMigrations,'disabled-in-code');assert.equal(Object.keys(good.featureFlags).length,5);
 const safe=publicRuntimeReadiness({...input,supabaseUrl:'https://username:private-password@abcdefghijklmnopqrst.supabase.co',model:'sk-proj-private-secret',commit:'private-commit-secret',node:'private-node-secret'});
 assert.equal(safe.projectRef,null);assert.equal(safe.ai.model,null);assert.equal(safe.commit,null);assert.equal(safe.node,null);assert.doesNotMatch(JSON.stringify(safe),/private-|password|username|unrelated_secret/);
});
