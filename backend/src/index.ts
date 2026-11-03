import { env } from './config/env';
import { connectDb } from './db';
import { createApp } from './app';
import { seedIfEmpty } from './seed';
import { ensureSystemRoles } from './lib/roles';

async function main() {
  await connectDb(env.mongoUri);
  await ensureSystemRoles();
  if (process.env.SEED_ON_START === 'true') await seedIfEmpty();
  createApp().listen(env.port, () => {
    console.log(`SNS Textiles API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
