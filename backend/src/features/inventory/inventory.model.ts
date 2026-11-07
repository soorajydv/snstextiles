import { Schema, model } from 'mongoose';

export const INVENTORY_CATEGORIES = ['Fabric', 'Printing', 'Thread', 'Trims', 'Packaging', 'Other'] as const;

const itemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, enum: INVENTORY_CATEGORIES, default: 'Other' },
    unit: { type: String, required: true, trim: true },
    onHand: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  },
  { timestamps: true },
);

const movementSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    type: { type: String, enum: ['in', 'out', 'adjust'], required: true },
    /** Signed change applied to onHand. */
    change: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    note: { type: String, trim: true, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
  },
  { timestamps: true },
);

export const InventoryItem = model('InventoryItem', itemSchema);
export const StockMovement = model('StockMovement', movementSchema);
