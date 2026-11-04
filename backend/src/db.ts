import mongoose from 'mongoose';
import { User } from './models/user.model';

async function backfillUsernames() {
  const users = await User.find({}).select('_id name email username');
  for (const user of users) {
    const nameBased = String(user.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    const emailBased = String(user.email ?? '').split('@')[0].toLowerCase();
    const needsUsername = !user.username;
    const isLegacyEmailUsername = user.username === emailBased && nameBased && nameBased !== emailBased;
    if (!needsUsername && !isLegacyEmailUsername) continue;
    const base = nameBased.length >= 3 ? nameBased.slice(0, 40) : `user-${String(user._id).slice(-8)}`;
    let username = base;
    if (await User.exists({ username })) username = `user-${String(user._id).slice(-8)}`;
    user.username = username;
    await user.save();
  }
}

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  // Build indexes declared on the schemas (unique order numbers, emails, SKUs).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  await backfillUsernames();
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}
