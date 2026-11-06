import { Schema, model } from 'mongoose';

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'system' },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: '' },
    summary: { type: String, default: '' },
    // MongoDB's TTL monitor removes the record once this timestamp is reached.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });

export const AuditLog = model('AuditLog', auditSchema);
