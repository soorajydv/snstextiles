import { z } from 'zod';
import { DELIVERY_METHODS, NECK_TYPES, PAYMENT_METHODS, SIZES, SLEEVES } from '../../lib/constants';
import { badRequest } from '../../lib/http';

export const playerSchema = z.object({
  name: z.string().trim().max(60).default(''),
  number: z.string().trim().max(6).default(''),
  sleeve: z.enum(SLEEVES).default('Half sleeve'),
  jerseySize: z.enum(SIZES).default(''),
  shortsSize: z.enum(SIZES).default(''),
  trouserSize: z.enum(SIZES).default(''),
});

export const specSchema = z.object({
  teamName: z.string().trim().max(120).optional(),
  productConfig: z.string().trim().min(1).max(120),
  neckType: z.enum(NECK_TYPES),
  shortsColor: z.string().trim().max(60).optional().default(''),
  quantity: z.coerce.number().int().min(1).max(5000),
  dueDate: z.coerce.date(),
  players: z.array(playerSchema).max(5000).optional().default([]),
  playerListMode: z.enum(['manual', 'image']).optional().default('manual'),
  comments: z.string().trim().max(4000).optional().default(''),
});

export const createSchema = specSchema.extend({
  customerId: z.string().optional(),
  newCustomer: z.object({ name: z.string().trim().min(2), phone: z.string().trim().max(40).optional().default('') }).optional(),
  unitRate: z.coerce.number().min(0).optional().default(0),
  advance: z.coerce.number().min(0).optional().default(0),
  advanceMethod: z.enum(PAYMENT_METHODS).optional().default('Cash'),
});

export const updateSchema = specSchema.partial().extend({
  unitRate: z.coerce.number().min(0).optional(),
});

export const approveSchema = z.object({ version: z.coerce.number().int().min(1) });
export const feedbackSchema = z.object({ message: z.string().trim().min(2).max(2000) });
export const advanceSchema = z.object({ note: z.string().trim().max(500).optional().default(''), checklistConfirmed: z.boolean().optional().default(false) });
export const sendBackSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason for rework').max(500) });

export const deliverSchema = z.object({
  packedQuantity: z.coerce.number().int().min(1),
  recipient: z.string().trim().min(2, 'Enter who received the goods').max(120),
  method: z.enum(DELIVERY_METHODS),
  trackingRef: z.string().trim().max(120).optional().default(''),
  note: z.string().trim().max(500).optional().default(''),
});

export type PlayerInput = z.infer<typeof playerSchema>;
export type CreateOrderInput = z.infer<typeof createSchema>;

/** Drops garment fields that don't apply to the chosen product configuration. */
export function normaliseSpec<T extends { productConfig?: string; shortsColor?: string; players?: z.infer<typeof playerSchema>[]; quantity?: number }>(spec: T): T {
  if (!spec.productConfig) return spec;
  const cfg = spec.productConfig.toLowerCase();
  const hasShorts = cfg.includes('shorts');
  const hasTrouser = cfg.includes('trouser');
  const plainShorts = cfg.includes('plain shorts');
  const players = (spec.players ?? []).map((p) => ({
    ...p,
    shortsSize: hasShorts ? p.shortsSize : '',
    trouserSize: hasTrouser ? p.trouserSize : '',
  }));
  if (spec.quantity !== undefined && players.length > spec.quantity) {
    throw badRequest(`players: ${players.length} player rows entered but quantity is ${spec.quantity}`);
  }
  return { ...spec, shortsColor: plainShorts ? spec.shortsColor : '', players };
}
