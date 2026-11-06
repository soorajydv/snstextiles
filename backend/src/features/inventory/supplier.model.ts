import { Schema, model } from 'mongoose';

const supplierSchema = new Schema({
  name: { type: String, required: true, trim: true },
  contactPerson: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  address: { type: String, trim: true, default: '' },
  panNumber: { type: String, trim: true, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const Supplier = model('Supplier', supplierSchema);
