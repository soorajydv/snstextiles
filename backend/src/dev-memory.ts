/**
 * Development mode without a local MongoDB install: starts an in-memory MongoDB,
 * seeds demo data and runs the API. Data is lost when the process stops.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './config/env';
import { connectDb } from './db';
import { createApp } from './app';
import { seedIfEmpty } from './seed';
import { ensureSystemRoles } from './features/roles/roles.service';
import { ensureSiteDefaults, seedDemoCatalogue } from './features/site/site.seed';

async function main() {
  const mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri('ss_textiles'));
  await ensureSystemRoles();
  await seedIfEmpty();
  await ensureSiteDefaults();
  await seedDemoCatalogue();
  const server = createApp().listen(env.port, () => {
    console.log(`SNS Textiles API (in-memory MongoDB) listening on http://localhost:${env.port}`);
  });
  const shutdown = async () => {
    server.close();
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
