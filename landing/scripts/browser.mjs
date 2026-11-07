import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function chromePath() {
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to your Chrome or Chromium executable.');
  return found;
}

export function launch() {
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ['--hide-scrollbars', '--font-render-hinting=none', '--force-color-profile=srgb'],
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
