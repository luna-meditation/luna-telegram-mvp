import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {realpathSync} from 'node:fs';
const root=dirname(fileURLToPath(import.meta.url));
const require=createRequire(realpathSync(resolve(root,'../../frontend/node_modules/vite/package.json')));
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
await build({entryPoints:[resolve(root,'functions/memory-smoke.mjs')],outfile:resolve(root,'dist-functions/memory-smoke.mjs'),bundle:true,platform:'node',target:'node22',format:'esm',banner:{js:'import {createRequire as __qaCreateRequire} from "node:module";const require=__qaCreateRequire(import.meta.url);'}});
