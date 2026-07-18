import { z } from 'zod';

export const supportCategories = ['problem', 'feedback', 'payment', 'contact', 'account_deletion'] as const;
export const supportStatuses = ['new', 'in_progress', 'resolved'] as const;

export const supportRequestInputSchema = z.object({
  category: z.enum(supportCategories),
  message: z.string().trim().min(10).max(4000),
  contact: z.string().trim().max(160).optional().default(''),
  appVersion: z.string().trim().max(80).optional().default('unknown'),
  buildSha: z.string().trim().max(160).optional().default('unknown'),
  platform: z.string().trim().max(80).optional().default('unknown')
});

export const supportStatusInputSchema = z.object({ status: z.enum(supportStatuses) });
