import { env } from './src/config/env';
import { connectDb } from './src/db';
import { createApp } from './src/app';
import { ensureSystemRoles } from './src/features/roles/roles.service';
import { ensureSiteDefaults } from './src/features/site/site.seed';

const app = createApp();

// Vercel may reuse this module across requests, so initialize MongoDB once per
// warm function instance and wait for it before passing the request to Express.
const databaseReady = connectDb(env.mongoUri).then(() => ensureSystemRoles()).then(() => ensureSiteDefaults());

export default async function handler(req: unknown, res: unknown) {
  await databaseReady;
  return app(req as never, res as never);
}
