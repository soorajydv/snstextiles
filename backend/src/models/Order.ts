import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { NECK_TYPES, SLEEVES, STAGES } from '../lib/constants';

const fileSchema = new Schema(
  {
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ['jersey', 'reference', 'player-list', 'artwork'], required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const playerSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    number: { type: String, trim: true, default: '' },
    sleeve: { type: String, enum: SLEEVES, default: 'Half sleeve' },
    jerseySize: { type: String, default: '' },
    shortsSize: { type: String, default: '' },
    trouserSize: { type: String, default: '' },
  },
  { _id: false },
);

const artworkSchema = new Schema(
  {
    version: { type: Number, required: true },
    file: { type: fileSchema, required: true },
    note: { type: String, default: '' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const feedbackSchema = new Schema(
  {
    version: { type: Number, required: true },
    message: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    from: { type: String, default: null },
    to: { type: String, enum: STAGES, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    teamName: { type: String, trim: true, required: true },
    productConfig: { type: String, trim: true, required: true, maxlength: 120 },
    neckType: { type: String, enum: NECK_TYPES, required: true },
    shortsColor: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true },
    unitRate: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    players: { type: [playerSchema], default: [] },
    playerListMode: { type: String, enum: ['manual', 'image'], default: 'manual' },
    cuttingStatus: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
    cuttingCompletedAt: { type: Date, default: null },
    cuttingCompletedByName: { type: String, default: '' },
    designChecklist: {
      playerListVerified: { type: Boolean, default: false },
      playerListVerifiedAt: { type: Date, default: null },
      playerListVerifiedByName: { type: String, default: '' },
    },
    comments: { type: String, trim: true, default: '' },
    files: { type: [fileSchema], default: [] },

    artworks: { type: [artworkSchema], default: [] },
    approval: {
      version: { type: Number, default: null },
      by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      byName: { type: String, default: '' },
      onBehalf: { type: Boolean, default: false },
      at: { type: Date, default: null },
    },
    feedback: { type: [feedbackSchema], default: [] },

    stage: { type: String, enum: STAGES, default: 'design', index: true },
    status: { type: String, default: 'Design in progress' },
    history: { type: [historySchema], default: [] },

    delivery: {
      deliveredAt: { type: Date, default: null },
      by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      byName: { type: String, default: '' },
      packedQuantity: { type: Number, default: null },
      recipient: { type: String, default: '' },
      method: { type: String, default: '' },
      trackingRef: { type: String, default: '' },
      note: { type: String, default: '' },
    },
    invoice: {
      number: { type: String, default: null },
      issuedAt: { type: Date, default: null },
      issuedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

orderSchema.index({ dueDate: 1 });

export type OrderAttrs = InferSchemaType<typeof orderSchema>;
export type OrderDoc = HydratedDocument<OrderAttrs>;
export const Order = model('Order', orderSchema);
