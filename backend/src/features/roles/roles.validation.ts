import { z } from 'zod';
import { PERMISSIONS } from '../../lib/constants';

export const roleSchema = z.object({
  key: z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes only'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().default(''),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

export const updateSchema = roleSchema.omit({ key: true });

export type RoleInput = z.infer<typeof roleSchema>;
