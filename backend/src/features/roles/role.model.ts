import { Schema, model } from 'mongoose';
import { PERMISSIONS } from '../../lib/constants';

const roleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    permissions: [{ type: String, enum: PERMISSIONS }],
    system: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Role = model('Role', roleSchema);
