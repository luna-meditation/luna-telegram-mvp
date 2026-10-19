import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
/** Tracked files only: unrelated local QA drafts or secrets never enter a release. */
export function releaseSourceDigest(root){
 const paths=execFileSync('git',['ls-files','-z','--','backend/src','backend/test','backend/scripts','backend/staging','backend/package.json','frontend/src','frontend/public','frontend/scripts','frontend/test','frontend/index.html','frontend/package.json','frontend/vite.config.ts','frontend/tsconfig.json','backend/tsconfig.json','supabase/migrations','package.json','pnpm-lock.yaml','netlify.toml','staging/netlify.toml','docs/LUNA-4.1-MODEL-BENCHMARK.json'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).sort();
 return createHash('sha256').update(JSON.stringify(paths.map(path=>[path,createHash('sha256').update(readFileSync(root+'/'+path)).digest('hex')]))).digest('hex');
}
