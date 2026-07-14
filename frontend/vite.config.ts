import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(process.env.VITE_COMMIT_SHA || process.env.COMMIT_REF || process.env.GIT_COMMIT_SHA || env.VITE_COMMIT_SHA || 'local'),
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(process.env.VITE_BUILD_TIMESTAMP || env.VITE_BUILD_TIMESTAMP || new Date().toISOString()),
      'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(process.env.VITE_DEPLOY_ENV || process.env.CONTEXT || env.VITE_DEPLOY_ENV || mode)
    }
  };
});
