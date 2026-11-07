import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  contactPerson: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.email(), z.literal('')]).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  panNumber: z.string().trim().max(30).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
});

export const createCustomerSchema = customerSchema.extend({
  email: z.email('Email is required for the customer login').trim().toLowerCase(),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(40).regex(/^[a-z0-9._-]+$/, 'Use only letters, numbers, dots, underscores or hyphens'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export const updateCustomerSchema = customerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
