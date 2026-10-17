import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
/** Load actual small pure modules and their local imports, not duplicated test logic. */
function moduleUrl(path){
 const javascript=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 const bundled=javascript.replace(/(from\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,(_match,before,specifier,after)=>{const base=resolve(dirname(path),specifier),candidates=[base,base+'.ts',base.replace(/\.js$/,'.ts')],file=candidates.find(p=>existsSync(p));if(!file)throw new Error('Missing local test module: '+specifier);return before+moduleUrl(file)+after;});
 return 'data:text/javascript;base64,'+Buffer.from(bundled).toString('base64');
}
export const importTypescript=path=>import(moduleUrl(path));
