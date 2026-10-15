import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {realpathSync} from 'node:fs';
const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(realpathSync(resolve(root,'../../frontend/node_modules/vite/package.json')));
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
const blobModules=process.env.LUNA23_QA_BLOBS_MODULES??resolve(root,'../luna23-ai-smoke/node_modules');
for(const [source,name] of [[resolve(root,'../../backend/staging/functions/luna-staging.mjs'),'luna-staging'],[resolve(root,'functions/memory-db-smoke.mjs'),'memory-db-smoke']]){
 await build({entryPoints:[source],outfile:resolve(root,'dist-functions',name+'.mjs'),bundle:true,platform:'node',target:'node22',format:'esm',nodePaths:[blobModules],banner:{js:'import {createRequire as __qaCreateRequire} from "node:module";const require=__qaCreateRequire(import.meta.url);'},external:['pg-native']});
}
