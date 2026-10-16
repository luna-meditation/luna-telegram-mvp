import test from 'node:test';import assert from 'node:assert/strict';
import {responseTokenBudget,safeValidationIssues} from './luna32-response-budget.js';
test('the production 800-token cap cannot truncate an attached natal or compatibility JSON envelope',()=>assert.equal(responseTokenBudget({ordinary:800,structured:2600,hasArtifact:true,detailed:false,guided:false}),2600));
test('ordinary conversation preserves its existing economical budget',()=>assert.equal(responseTokenBudget({ordinary:800,structured:2600,hasArtifact:false,detailed:false,guided:false}),800));
test('depth is deliberate and bounded, never an unlimited retry',()=>{assert.equal(responseTokenBudget({ordinary:800,structured:2600,hasArtifact:false,detailed:true,guided:false}),2600);assert.equal(responseTokenBudget({ordinary:800,structured:99999,hasArtifact:true,detailed:true,guided:false}),8192);});
test('validation diagnostics never contain values or personal context',()=>assert.deepEqual(safeValidationIssues({issues:[{code:'too_big',path:['actions'],input:'private secret'}]}),[{code:'too_big',path:'actions'}]));
