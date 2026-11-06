import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { HttpError } from '../lib/http';
import { env } from '../config/env';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof multer.MulterError) {
    const maxSize = err.field === 'avatar' || err.field === 'logo' ? '5 MB' : `${Number(process.env.MAX_UPLOAD_MB ?? 15)} MB`;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `${err.field ? `${err.field} ` : ''}file is too large. Maximum size is ${maxSize}.`
      : err.code === 'LIMIT_FILE_COUNT'
        ? 'Too many files uploaded. Please reduce the number of files and try again.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Unexpected upload field${err.field ? `: ${err.field}` : ''}.`
          : err.message;
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    res.status(400).json({ error: first?.message ?? 'Validation failed' });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: `Invalid value for ${err.path}` });
    return;
  }
  if (typeof err === 'object' && err && (err as { code?: number }).code === 11000) {
    const keys = Object.keys((err as { keyValue?: object }).keyValue ?? {});
    res.status(409).json({ error: `A record with this ${keys.join(', ') || 'value'} already exists` });
    return;
  }
  console.error(err);
  if (!env.isProd) {
    const error = err instanceof Error ? err : new Error(String(err));
    res.status(500).json({
      error: error.message || 'Unexpected server error',
      name: error.name,
      stack: error.stack,
    });
    return;
  }
  res.status(500).json({ error: 'Something went wrong on the server' });
}
