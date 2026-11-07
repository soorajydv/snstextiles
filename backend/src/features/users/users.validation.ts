import { z } from 'zod';

export const customerDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Customer / club name is required'),
  contactPerson: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.email(), z.literal('')]).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  panNumber: z.string().trim().max(30).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
});

export const createSchema = z.object({
  name: z.string().trim().min(2),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(40).regex(/^[a-z0-9._-]+$/, 'Use only letters, numbers, dots, underscores or hyphens'),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.string().trim().toLowerCase().min(2).max(40),
  phone: z.string().trim().max(30).optional().default(''),
  customer: z.string().nullish(),
  customerDetails: customerDetailsSchema.optional(),
});

export const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(40).regex(/^[a-z0-9._-]+$/, 'Use only letters, numbers, dots, underscores or hyphens').optional(),
  role: z.string().trim().toLowerCase().min(2).max(40).optional(),
  phone: z.string().trim().max(30).optional(),
  active: z.boolean().optional(),
  customer: z.string().nullish(),
  customerDetails: customerDetailsSchema.optional(),
});

export const resetPasswordSchema = z.object({ password: z.string().min(8, 'Use at least 8 characters') });

export type CustomerDetailsInput = z.infer<typeof customerDetailsSchema>;
export type CreateUserInput = z.infer<typeof createSchema>;
export type UpdateUserInput = z.infer<typeof updateSchema>;
