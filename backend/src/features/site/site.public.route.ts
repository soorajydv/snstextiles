import crypto from 'crypto';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { badRequest } from '../../lib/http';
import { ALLOWED_EXTENSIONS, upload } from '../../lib/uploads';
import { requireAuth, requirePermission } from '../../middleware/auth';
import {
  cartPricesController, categoriesController, checkoutController, enquiryController, mediaController, pageController, postController,
  postsController, productController, productsController, reviewController, siteShellController, sitemapController,
  subscribeController, trackController,
} from './site.public.controller';

const router = Router();

const limiter = (limit: number, windowMinutes = 15) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
});

const enquiryUpload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: Math.min(env.maxUploadBytes, 10 * 1024 * 1024), files: 4 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) { cb(badRequest('Upload PNG, JPG, PDF, AI, EPS, SVG, PSD or CDR files')); return; }
    cb(null, true);
  },
});

// ---------- site shell ----------
router.get('/settings', siteShellController);
router.get('/media/:storedName', mediaController);

// ---------- catalogue ----------
router.get('/categories', categoriesController);
router.get('/products', productsController);
router.get('/products/:slug', productController);
router.post('/cart/prices', cartPricesController);

// ---------- content ----------
router.get('/pages/:slug', pageController);
router.get('/posts', postsController);
router.get('/posts/:slug', postController);
router.get('/sitemap', sitemapController);

// ---------- forms ----------
router.post('/enquiries', limiter(8), enquiryUpload.array('files', 4), enquiryController);
router.post('/reviews', limiter(6, 60), reviewController);
router.post('/subscribe', limiter(10, 60), subscribeController);
router.post('/track', limiter(20), trackController);

// ---------- checkout (signed-in customers) ----------
router.post('/checkout', limiter(15), requireAuth, requirePermission('orders.create'), upload.any(), checkoutController);

export default router;
