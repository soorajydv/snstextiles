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
const can = requirePermission;

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
router.get('/overview', can('site.overview'), overviewController);
router.get('/settings', can('site.settings.view'), getSettingsController);
router.put('/settings', can('site.settings.update'), updateSettingsController);

// ---------- media ----------
router.get('/media', can('site.media.view'), listMediaController);
router.post('/media', can('site.media.upload'), imageUpload.array('files', 20), uploadMediaController);
router.delete('/media/:id', can('site.media.delete'), deleteMediaController);

// ---------- categories ----------
router.get('/categories', can('site.categories.view'), listCategoriesController);
router.post('/categories', can('site.categories.create'), createCategoryController);
router.put('/categories/:id', can('site.categories.update'), updateCategoryController);
router.delete('/categories/:id', can('site.categories.delete'), deleteCategoryController);

// ---------- products ----------
router.get('/products', can('site.products.view'), listProductsController);
router.get('/products/:id', can('site.products.view'), getProductController);
router.post('/products', can('site.products.create'), createProductController);
router.put('/products/:id', can('site.products.update'), updateProductController);
router.patch('/products/:id', can('site.products.update'), patchProductController);
router.delete('/products/:id', can('site.products.delete'), deleteProductController);
router.post('/products/import', can('site.products.import'), importUpload.array('files', 6), importProductsController);
router.post('/products/localize-images', can('site.products.import'), localizeImagesController);

// ---------- pages & posts ----------
router.get('/pages', can('site.pages.view'), listPagesController);
router.post('/pages', can('site.pages.create'), createPageController);
router.put('/pages/:id', can('site.pages.update'), updatePageController);
router.delete('/pages/:id', can('site.pages.delete'), deletePageController);
router.get('/posts', can('site.posts.view'), listPostsController);
router.post('/posts', can('site.posts.create'), createPostController);
router.put('/posts/:id', can('site.posts.update'), updatePostController);
router.delete('/posts/:id', can('site.posts.delete'), deletePostController);

// ---------- enquiries ----------
router.get('/enquiries', can('site.enquiries.view'), listEnquiriesController);
router.patch('/enquiries/:id', can('site.enquiries.update'), updateEnquiryController);
router.delete('/enquiries/:id', can('site.enquiries.delete'), deleteEnquiryController);
router.get('/enquiries/:id/files/:storedName', can('site.enquiries.view'), enquiryFileController);

// ---------- reviews ----------
router.get('/reviews', can('site.reviews.view'), listReviewsController);
router.patch('/reviews/:id', can('site.reviews.moderate'), updateReviewController);
router.delete('/reviews/:id', can('site.reviews.delete'), deleteReviewController);

// ---------- subscribers ----------
router.get('/subscribers', can('site.subscribers.view'), listSubscribersController);
router.get('/subscribers/export', can('site.subscribers.export'), exportSubscribersController);
router.delete('/subscribers/:id', can('site.subscribers.delete'), deleteSubscriberController);

export default router;
