/**
 * Renders the scenes in studio/scenes.js to MP4 (H.264) plus a poster JPEG in site/media.
 *
 *   npm run render                    all scenes
 *   npm run render -- orders,billing  some scenes
 *   npm run render -- orders --stills 2,6.5,14   just save PNG stills to .frames/ for checking
 *
 * Each frame is drawn by studio/player.js for an exact time t, screenshotted by headless Chrome and
 * piped to ffmpeg, so output is deterministic and needs no screen recording.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { launch } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYER = pathToFileURL(path.join(ROOT, 'studio', 'player.html')).href;
const OUT = path.join(ROOT, 'site', 'media');
const FRAMES = path.join(ROOT, '.frames');
const FPS = Number(process.env.FPS ?? 30);

const args = process.argv.slice(2);
const stillsAt = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null;
const only = args[0] && !args[0].startsWith('--') ? args[0].split(',') : null;

fs.mkdirSync(OUT, { recursive: true });

function encoder(file) {
  const ff = spawn(ffmpegPath, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))));
  return { ff, done };
}

const write = (stream, buf) => new Promise((resolve) => (stream.write(buf) ? resolve() : stream.once('drain', resolve)));

const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('player error:', e.message));
  await page.goto(`${PLAYER}?render`, { waitUntil: 'networkidle0' });
  const scenes = await page.evaluate(() => Object.keys(window.SCENES));

  for (const name of scenes) {
    if (only && !only.includes(name)) continue;
    await page.goto(`${PLAYER}?render&scene=${name}`, { waitUntil: 'networkidle0' });
    const { duration, poster } = await page.evaluate((n) => window.__setup(n), name);
    const shoot = (t, type = 'jpeg') => page.evaluate((t) => window.__render(t), t).then(() => page.$('#stage')).then((s) => s.screenshot({ type, quality: type === 'jpeg' ? 92 : undefined, optimizeForSpeed: true }));

    if (stillsAt) {
      fs.mkdirSync(FRAMES, { recursive: true });
      for (const t of stillsAt) fs.writeFileSync(path.join(FRAMES, `${name}-${t}.png`), await shoot(t, 'png'));
      console.log(`${name}: stills ${stillsAt.join(', ')} → .frames/`);
      continue;
    }

    const started = Date.now();
    const file = path.join(OUT, `${name}.mp4`);
    const { ff, done } = encoder(file);
    const total = Math.round(duration * FPS);
    for (let f = 0; f < total; f++) {
      await write(ff.stdin, await shoot(f / FPS));
      if (f % FPS === 0) process.stdout.write(`\r${name}: ${Math.round((f / total) * 100)}%  `);
    }
    ff.stdin.end();
    await done;
    fs.writeFileSync(path.join(OUT, `${name}.jpg`), await shoot(poster));
    const mb = (fs.statSync(file).size / 1048576).toFixed(1);
    console.log(`\r${name}: ${total} frames, ${duration}s, ${mb} MB in ${Math.round((Date.now() - started) / 1000)}s`);
  }
} finally {
  await browser.close();
}
