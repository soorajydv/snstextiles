import { z } from 'zod';
import { INVENTORY_CATEGORIES } from './inventory.model';

export const supplierSchema = z.object({ name: z.string().trim().min(2).max(120), contactPerson: z.string().trim().max(120).optional().default(''), phone: z.string().trim().max(40).optional().default(''), email: z.string().trim().email().optional().or(z.literal('')).default(''), address: z.string().trim().max(300).optional().default(''), panNumber: z.string().trim().max(30).optional().default('') });

export const itemSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9-_]+$/, 'Use letters, numbers and dashes only'),
  category: z.enum(INVENTORY_CATEGORIES).default('Other'),
  unit: z.string().trim().min(1).max(20),
  reorderLevel: z.coerce.number().min(0).default(0),
  openingStock: z.coerce.number().min(0).optional().default(0),
  supplierId: z.string().nullish(),
});

export const itemUpdateSchema = itemSchema.omit({ openingStock: true }).partial().extend({ active: z.boolean().optional() });

export const movementSchema = z.object({
  type: z.enum(['in', 'out', 'adjust']),
  /** For in/out: quantity moved. For adjust: the counted quantity on hand. */
  quantity: z.coerce.number().min(0),
  note: z.string().trim().max(300).optional().default(''),
  orderNo: z.string().trim().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type ItemInput = z.infer<typeof itemSchema>;
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
