import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import {linkSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Optional local hard-link optimization for immutable static assets.
  // Cloud builds retain Vite's normal public-directory handling.
  const cloneAssets=process.env.LUNA_LOCAL_LINK_ASSETS==='true';
  function linkAssets(source:string,target:string){mkdirSync(target,{recursive:true});for(const entry of readdirSync(source,{withFileTypes:true})){const from=resolve(source,entry.name),to=resolve(target,entry.name);if(entry.isDirectory())linkAssets(from,to);else if(entry.isFile())linkSync(from,to);else throw new Error('Static asset links must be reviewed before packaging.');}}
  let outputDirectory='dist';
  return {
    plugins: [react(),...(cloneAssets?[{name:'luna-local-link-static-assets',configResolved(config:{build:{outDir:string}}){outputDirectory=config.build.outDir;},closeBundle(){linkAssets(resolve(process.cwd(),'public'),resolve(process.cwd(),outputDirectory));}}]:[])],
    build: {copyPublicDir:!cloneAssets,rollupOptions:{output:{manualChunks(id){if(/node_modules\/(react|react-dom|scheduler)\//.test(id))return 'react-vendor';}}}},
    define: {
      'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(process.env.VITE_COMMIT_SHA || process.env.COMMIT_REF || process.env.GIT_COMMIT_SHA || env.VITE_COMMIT_SHA || 'local'),
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(process.env.VITE_BUILD_TIMESTAMP || env.VITE_BUILD_TIMESTAMP || new Date().toISOString()),
      'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(process.env.VITE_DEPLOY_ENV || process.env.CONTEXT || env.VITE_DEPLOY_ENV || mode)
    }
  };
});
