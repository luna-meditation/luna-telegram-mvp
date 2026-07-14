import { env } from './config.js';

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? 'unknown';
}

export function getBackendVersion() {
  return {
    commitSha: firstDefined(process.env.RAILWAY_GIT_COMMIT_SHA, process.env.COMMIT_SHA, process.env.GIT_COMMIT_SHA),
    buildTimestamp: firstDefined(process.env.BUILD_TIMESTAMP, process.env.RAILWAY_DEPLOYMENT_CREATED_AT),
    environment: firstDefined(process.env.RAILWAY_ENVIRONMENT_NAME, process.env.NODE_ENV),
    serviceName: firstDefined(process.env.RAILWAY_SERVICE_NAME, 'luna-backend'),
    apiVersion: 'v1',
    aiChatEnabled: env.AI_CHAT_ENABLED,
    aiModel: env.AI_CHAT_MODEL
  };
}
