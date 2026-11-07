import { z } from 'zod';

const prefix = z.string().trim().min(1).max(8).regex(/^[A-Z0-9]+$/, 'Use capital letters and numbers only');

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300).default(''),
  phone: z.string().trim().max(60).default(''),
  email: z.string().trim().max(120).default(''),
  panNumber: z.string().trim().max(30).default(''),
  orderPrefix: prefix,
  invoicePrefix: prefix,
  dueSoonDays: z.coerce.number().int().min(1).max(30),
  auditRetentionDays: z.coerce.number().int().min(1).max(3650).optional(),
  invoiceFooter: z.string().trim().max(500).default(''),
});

export const auditRetentionSchema = z.object({ auditRetentionDays: z.coerce.number().int().min(1).max(3650) });

export type SettingsInput = z.infer<typeof settingsSchema>;
export type AuditRetentionInput = z.infer<typeof auditRetentionSchema>;
