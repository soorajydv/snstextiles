import { Router } from 'express';
import multer from 'multer';
import { badRequest } from '../../lib/http';
import { requirePermission } from '../../middleware/auth';
import {
  createCategoryController, createPageController, createPostController, createProductController, deleteCategoryController,
  deleteEnquiryController, deleteMediaController, deletePageController, deletePostController, deleteProductController,
  deleteReviewController, deleteSubscriberController, enquiryFileController, exportSubscribersController, getProductController,
  getSettingsController, importProductsController, listCategoriesController, listEnquiriesController, listMediaController,
  listPagesController, listPostsController, listProductsController, listReviewsController, listSubscribersController,
  localizeImagesController, overviewController, patchProductController, updateCategoryController, updateEnquiryController,
  updatePageController, updatePostController, updateProductController, updateReviewController, updateSettingsController,
  uploadMediaController,
} from './site.admin.controller';

const router = Router();
const view = requirePermission('site.view');
const manage = requirePermission('site.manage');
const enquiries = requirePermission('site.enquiries');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.mimetype)) { cb(badRequest('Upload PNG, JPG, WEBP, GIF or AVIF images')); return; }
    cb(null, true);
  },
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(csv|xml)$/i.test(file.originalname)) { cb(badRequest('Upload the WooCommerce CSV export (and optionally product sitemap .xml files)')); return; }
    cb(null, true);
  },
});

// ---------- overview & settings ----------
router.get('/overview', view, overviewController);
router.get('/settings', view, getSettingsController);
router.put('/settings', manage, updateSettingsController);

// ---------- media ----------
router.get('/media', view, listMediaController);
router.post('/media', manage, imageUpload.array('files', 20), uploadMediaController);
router.delete('/media/:id', manage, deleteMediaController);

// ---------- categories ----------
router.get('/categories', view, listCategoriesController);
router.post('/categories', manage, createCategoryController);
router.put('/categories/:id', manage, updateCategoryController);
router.delete('/categories/:id', manage, deleteCategoryController);

// ---------- products ----------
router.get('/products', view, listProductsController);
router.get('/products/:id', view, getProductController);
router.post('/products', manage, createProductController);
router.put('/products/:id', manage, updateProductController);
router.patch('/products/:id', manage, patchProductController);
router.delete('/products/:id', manage, deleteProductController);
router.post('/products/import', manage, importUpload.array('files', 6), importProductsController);
router.post('/products/localize-images', manage, localizeImagesController);

// ---------- pages & posts ----------
router.get('/pages', view, listPagesController);
router.post('/pages', manage, createPageController);
router.put('/pages/:id', manage, updatePageController);
router.delete('/pages/:id', manage, deletePageController);
router.get('/posts', view, listPostsController);
router.post('/posts', manage, createPostController);
router.put('/posts/:id', manage, updatePostController);
router.delete('/posts/:id', manage, deletePostController);

// ---------- enquiries ----------
router.get('/enquiries', enquiries, listEnquiriesController);
router.patch('/enquiries/:id', enquiries, updateEnquiryController);
router.delete('/enquiries/:id', enquiries, deleteEnquiryController);
router.get('/enquiries/:id/files/:storedName', enquiries, enquiryFileController);

// ---------- reviews ----------
router.get('/reviews', view, listReviewsController);
router.patch('/reviews/:id', manage, updateReviewController);
router.delete('/reviews/:id', manage, deleteReviewController);

// ---------- subscribers ----------
router.get('/subscribers', view, listSubscribersController);
router.get('/subscribers/export', view, exportSubscribersController);
router.delete('/subscribers/:id', manage, deleteSubscriberController);

export default router;
