import {z} from 'zod';
export const adminRoles=['owner','administrator','content_manager','support_agent','analyst'] as const;
export type AdminRole=typeof adminRoles[number];
export type AdminPermission='analytics.read'|'users.read'|'content.read'|'content.write'|'support.read'|'support.write'|'configuration.read'|'financial.write'|'roles.write';
const permissions:Record<AdminRole,readonly AdminPermission[]>={owner:['analytics.read','users.read','content.read','content.write','support.read','support.write','configuration.read','financial.write','roles.write'],administrator:['analytics.read','users.read','content.read','content.write','support.read','support.write','configuration.read'],content_manager:['content.read','content.write'],support_agent:['users.read','support.read','support.write'],analyst:['analytics.read']};
export const adminPermissions=(role:AdminRole)=>[...permissions[role]];
export const hasAdminPermission=(role:AdminRole,permission:AdminPermission)=>permissions[role].includes(permission);
export const adminPeriodInput=z.object({from:z.string().datetime({offset:true}),to:z.string().datetime({offset:true})}).strict().refine(v=>{const span=Date.parse(v.to)-Date.parse(v.from);return span>0&&span<=366*86400000;},'Select a period of at most 366 days.');
export const adminUsersInput=z.object({search:z.string().max(100).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),size:z.coerce.number().int().min(1).max(50).default(25),sort:z.enum(['registered','seen','balance']).default('registered'),plan:z.enum(['all','free','active','lifetime','expired']).default('all')}).strict();
