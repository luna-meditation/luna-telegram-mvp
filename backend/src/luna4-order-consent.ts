import {z} from 'zod';
/** The existing immutable order snapshot, not a new pricing authority. */
export const starsTermsSchema=z.object({product:z.string().min(1).max(40),stars:z.number().int().min(1).max(10000),seeds:z.number().int().min(0).max(10000),days:z.number().int().min(0).max(365),recurring:z.literal(false),plan:z.enum(['weekly','monthly','annual','lifetime']).nullable(),allowances:z.object({standard:z.number().int().min(0).max(10000),three:z.number().int().min(0).max(10000),deep:z.number().int().min(0).max(10000),premiumMeditations:z.boolean(),basicPortrait:z.boolean()}).strict().nullable(),allowanceScope:z.enum(['subscription_week','subscription_month']).nullable()}).strict();
export type StarsTerms=z.infer<typeof starsTermsSchema>;
