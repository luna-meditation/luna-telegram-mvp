import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {realpathSync,readFileSync} from 'node:fs';
const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(realpathSync(resolve(root,'../../frontend/node_modules/vite/package.json')));
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
const blobModules=process.env.LUNA23_QA_BLOBS_MODULES??resolve(root,'../luna23-ai-smoke/node_modules');
// Embed the existing canonical text catalog: no filesystem assumptions in Lambda.
const catalog=JSON.parse(readFileSync(resolve(root,'../../backend/dist/tarot-catalog.json'),'utf8'));
assert.equal(catalog.cards.length,78);
assert.equal(new Set(catalog.cards.map(card=>card.id)).size,78);
assert.ok(catalog.cards.every(card=>['en','ru'].every(language=>['upright','reversed'].every(orientation=>typeof card.meaning?.[language]?.[orientation]==='string'))));
const catalogPlugin={name:'canonical-tarot-catalog',setup(builder){builder.onLoad({filter:/tarot-policy[.]js$/},args=>{
 const original=readFileSync(args.path,'utf8');
 const contents=original.replace(/^const manifest = .*;$/m,'const manifest = '+JSON.stringify(catalog)+';');
 assert.notEqual(contents,original,'Canonical catalog embedding must match exactly once');
 return {contents,loader:'js',resolveDir:dirname(args.path)};
});}};
for(const [source,name] of [[resolve(root,'../../backend/staging/functions/luna-staging.mjs'),'luna-staging'],[resolve(root,'functions/memory-db-smoke.mjs'),'memory-db-smoke']]){
 await build({entryPoints:[source],outfile:resolve(root,'dist-functions',name+'.mjs'),bundle:true,platform:'node',target:'node22',format:'esm',nodePaths:[blobModules],plugins:[catalogPlugin],banner:{js:'import {createRequire as __qaCreateRequire} from "node:module";const require=__qaCreateRequire(import.meta.url);'},external:['pg-native']});
}
