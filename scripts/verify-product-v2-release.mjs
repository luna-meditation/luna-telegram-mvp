import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {verifyProductV2Evidence} from '../frontend/scripts/product-v2-release-gates.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
verifyProductV2Evidence(JSON.parse(readFileSync(resolve(root,'qa/product-v2-release-review.json'),'utf8')),root);
console.log('Product Experience v2 source, security, recovery and functional gates: PASS');
