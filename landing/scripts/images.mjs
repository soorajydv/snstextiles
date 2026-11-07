/** Exports the screenshots used on the landing page from studio/shots to site/img as WebP. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'studio', 'shots');
const OUT = path.join(ROOT, 'site', 'img');

// shot → output width in pixels
const IMAGES = {
  dashboard: 1600,
  customers: 1200,
  delivery: 1200,
  activity: 1200,
  users: 1200,
  settings: 1200,
  'order-created': 1200,
  'tracker-0': 1200,
  'm-dashboard': 640,
  'm-production': 640,
  'm-order': 640,
  'm-billing': 640,
};

fs.mkdirSync(OUT, { recursive: true });
for (const [shot, width] of Object.entries(IMAGES)) {
  const src = path.join(SHOTS, `${shot}.png`);
  if (!fs.existsSync(src)) { console.warn(`missing ${shot}.png, run npm run capture`); continue; }
  const dest = path.join(OUT, `${shot}.webp`);
  execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=${width}:-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', '82', dest]);
  console.log(`${shot}.webp ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
}
