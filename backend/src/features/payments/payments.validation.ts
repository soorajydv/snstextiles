import { z } from 'zod';
import { PAYMENT_METHODS } from '../../lib/constants';

export const createSchema = z.object({
  orderId: z.string(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
  receivedAt: z.coerce.date().optional(),
});

export const rejectSchema = z.object({ reason: z.string().trim().min(2).max(500) });

export type CreatePaymentInput = z.infer<typeof createSchema>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional().or(z.literal('').transform(() => undefined));

/** Filters shared by the billing summary and CSV exports. */
export const billingQuerySchema = z.object({
  customer: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid customer').optional().or(z.literal('').transform(() => undefined)),
  from: day,
  to: day,
  payment: z.enum(['quote', 'unpaid', 'part', 'paid', 'due']).optional().or(z.literal('').transform(() => undefined)),
  status: z.enum(['pending', 'verified', 'rejected', 'reversed']).optional().or(z.literal('').transform(() => undefined)),
});

export type BillingQuery = z.infer<typeof billingQuerySchema>;
