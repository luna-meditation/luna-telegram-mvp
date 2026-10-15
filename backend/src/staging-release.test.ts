import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('Telegram staging ships only the authenticated application, not the private smoke worker',()=>{
  const config=readFileSync(new URL('../../staging/netlify.toml',import.meta.url),'utf8');
  const builder=readFileSync(new URL('../../qa/luna23-staging-live/build-bundle.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(config,/to\s*=\s*"[^"\n]*memory-db-smoke/);
  assert.doesNotMatch(builder,/functions\/memory-db-smoke|dist-functions/);
  assert.match(builder,/dist-telegram-functions\/luna-staging[.]mjs/);
  assert.match(config,/from = "\/qa\/\*"\s+to = "\/index.html"\s+status = 404/);
});
