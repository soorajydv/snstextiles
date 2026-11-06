import { Schema, model } from 'mongoose';
import { PAYMENT_METHODS } from '../lib/constants';

export const PAYMENT_STATUSES = ['pending', 'verified', 'rejected', 'reversed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    proof: {
      storedName: { type: String, default: null },
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },
    receivedAt: { type: Date, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'verified', index: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: '' },
    reversalReason: { type: String, trim: true, default: '' },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Payment = model('Payment', paymentSchema);
