import { env } from './config/env';
import { connectDb } from './db';
import { createApp } from './app';
import { seedIfEmpty } from './seed';
import { ensureSystemRoles } from './features/roles/roles.service';
import { ensureSiteDefaults } from './features/site/site.seed';
import { User } from './features/users/user.model';

async function migrateLegacyAvatars() {
  await User.collection.updateMany(
    { avatarUrl: { $in: [null, ''] }, avatarStoredName: { $type: 'string' } },
    [{ $set: { avatarUrl: { $concat: [env.appUrl, '/api/auth/avatar/', '$avatarStoredName'] } } }],
  );
  await User.collection.updateMany(
    { avatarUrl: { $type: 'string' }, avatarStoredName: { $type: 'string' } },
    { $unset: { avatarStoredName: '', avatarMimeType: '' } },
  );
}

async function main() {
  await connectDb(env.mongoUri);
  await migrateLegacyAvatars();
  await ensureSystemRoles();
  await ensureSiteDefaults();
  if (process.env.SEED_ON_START === 'true') await seedIfEmpty();
  createApp().listen(env.port, () => {
    console.log(`SNS Textiles API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
