import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, lowercase: true, trim: true },
    /** Set only for customer accounts: the customer record they may access. */
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    phone: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    avatarStoredName: { type: String, default: null },
    avatarMimeType: { type: String, default: null },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
