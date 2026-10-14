import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const ts=createRequire(import.meta.url)('typescript');
export function tarotModuleUrl(file){
 const source=readFileSync(resolve('src/features/tarot',file),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 if(file==='session.ts')code=code.replace("from './spreadSession'",`from '${tarotModuleUrl('spreadSession.ts')}'`);
 return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
