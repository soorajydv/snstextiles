import { Schema, model } from 'mongoose';

const favoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'SiteProduct', required: true, index: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ user: 1, product: 1 }, { unique: true });

export const SiteFavorite = model('SiteFavorite', favoriteSchema);
