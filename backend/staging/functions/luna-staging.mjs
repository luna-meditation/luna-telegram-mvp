// Separate opt-in deployment: never loaded by the production Netlify config.
export {netlifyStagingHandler as default} from '../../dist/netlify-staging-handler.js';
// Explicit staging rewrites preserve API routing ahead of the SPA fallback.
