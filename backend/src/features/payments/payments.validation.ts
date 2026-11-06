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
