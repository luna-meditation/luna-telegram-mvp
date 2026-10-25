import assert from 'node:assert/strict';
import test from 'node:test';
import {z} from 'zod';

test('collection upper bounds reject before walking oversized untrusted values', async () => {
  let visited=0;
  const value=z.string().superRefine(()=>{visited++;});
  const oversized=Array.from({length:10000},()=> 'synthetic');
  for(const schema of [z.array(value).max(2),z.array(value).length(2)]){
    visited=0;
    const result=schema.safeParse(oversized);
    assert.equal(result.success,false);
    if(!result.success){assert.equal(result.error.issues.length,1);assert.equal(result.error.issues[0].code,'too_big');}
    assert.equal(visited,0,'Oversized arrays must fail before per-element validation');
    assert.equal((await schema.safeParseAsync(oversized)).success,false);
    assert.equal(visited,0,'Async validation must keep the same resource boundary');
  }
  const accepted=z.array(z.string().transform(value=>value.trim())).max(2).parse([' one ',' two ']);
  assert.deepEqual(accepted,['one','two']);
  assert.equal(z.array(z.string()).max(2).safeParse([1]).success,false);
  assert.deepEqual(z.record(z.string(),z.unknown()).parse({summary:'synthetic',count:2}),{summary:'synthetic',count:2});
});
