import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { env } from '../config/env';
import { badRequest } from './http';

export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.ai', '.eps', '.svg', '.psd', '.cdr'];
const INLINE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: env.uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['advanceProof', 'proof', 'playerListImage'].includes(file.fieldname) && !AVATAR_MIME.includes(file.mimetype)) {
      cb(badRequest(`${file.fieldname}: Only PNG, JPG, JPEG or WEBP images are allowed`));
      return;
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      cb(badRequest(`File type ${ext || 'unknown'} is not allowed`));
      return;
    }
    cb(null, true);
  },
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_MIME.includes(file.mimetype)) {
      cb(badRequest('Only PNG, JPG, JPEG, WEBP or GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

/** Safe absolute path for a stored file name (prevents path traversal). */
export function storedFilePath(storedName: string): string {
  const base = path.basename(storedName);
  return path.join(env.uploadDir, base);
}

/** Only render known-safe types inline; everything else (incl. SVG) downloads. */
export function isInlineSafe(mimeType: string) {
  return INLINE_MIME.includes(mimeType);
}

export function removeUploadedFiles(files: Express.Multer.File[] | undefined) {
  for (const f of files ?? []) fs.promises.unlink(f.path).catch(() => undefined);
}

/** Compresses uploaded raster images in place so image-heavy orders use less storage and bandwidth. */
export async function compressUploadedImage(file: Express.Multer.File): Promise<Express.Multer.File> {
  if (!AVATAR_MIME.includes(file.mimetype)) return file;
  const storedName = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
  const outputPath = storedFilePath(storedName);
  await sharp(file.path)
    .rotate()
    .webp({ quality: 78, effort: 4 })
    .toFile(outputPath);
  await fs.promises.unlink(file.path);
  file.filename = storedName;
  file.path = outputPath;
  file.mimetype = 'image/webp';
  file.size = (await fs.promises.stat(outputPath)).size;
  return file;
}

export function removeStoredFile(storedName: string | null | undefined) {
  if (storedName) fs.promises.unlink(storedFilePath(storedName)).catch(() => undefined);
}
