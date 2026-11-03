import { Schema, model } from 'mongoose';

const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'global' },
    businessName: { type: String, default: 'SNS TEXTILES PVT LTD' },
    logoStoredName: { type: String, default: null },
    logoMimeType: { type: String, default: null },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    currency: { type: String, default: 'NPR' },
    timezone: { type: String, default: 'Asia/Kathmandu' },
    orderPrefix: { type: String, default: 'SS' },
    invoicePrefix: { type: String, default: 'INV' },
    dueSoonDays: { type: Number, default: 3 },
    auditRetentionDays: { type: Number, default: 365, min: 1, max: 3650 },
    invoiceFooter: { type: String, default: 'Thank you for your business.' },
  },
  { timestamps: true },
);

export const Settings = model('Settings', settingsSchema);

export async function getSettings() {
  const existing = await Settings.findById('global');
  if (existing) return existing;
  return Settings.create({ _id: 'global' });
}
