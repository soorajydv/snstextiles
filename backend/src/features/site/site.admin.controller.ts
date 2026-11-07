import type { Request, Response } from 'express';
import { assertObjectId, parse } from '../../lib/http';
import { currentUser } from '../../middleware/auth';
import {
  createCategory, createPage, createPost, createProduct, deleteCategory, deleteEnquiry, deleteMedia, deletePage, deletePost,
  deleteProduct, deleteReview, deleteSubscriber, exportSubscribersCsv, getAdminProduct, getAdminSettings, getEnquiryFile, getOverview,
  importProducts, listAdminCategories, listAdminPages, listAdminPosts, listAdminProducts, listEnquiries, listMedia, listReviews,
  listSubscribers, localizeImages, patchProduct, updateCategory, updateEnquiry, updatePage, updatePost, updateProduct, updateReview,
  updateSiteSettings, uploadMedia,
} from './site.admin.service';
import {
  categorySchema, enquiryUpdateSchema, pageSchema, postSchema, productPatchSchema, productSchema, reviewUpdateSchema, siteSettingsSchema,
} from './site.validation';

const idParam = (value: unknown, what: string) => assertObjectId(typeof value === 'string' ? value : '', what);
const query = (req: Request) => req.query as Record<string, unknown>;
const files = (req: Request) => (req.files as Express.Multer.File[] | undefined) ?? [];

// ---------- overview & settings ----------

export async function overviewController(_req: Request, res: Response) {
  res.json(await getOverview());
}

export async function getSettingsController(_req: Request, res: Response) {
  res.json(await getAdminSettings());
}

export async function updateSettingsController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(siteSettingsSchema, req.body);
  res.json(await updateSiteSettings(me, body));
}

// ---------- media ----------

export async function listMediaController(req: Request, res: Response) {
  res.json(await listMedia(query(req)));
}

export async function uploadMediaController(req: Request, res: Response) {
  const me = currentUser(req);
  res.status(201).json(await uploadMedia(me, files(req)));
}

export async function deleteMediaController(req: Request, res: Response) {
  res.json(await deleteMedia(idParam(req.params.id, 'Image')));
}

// ---------- categories ----------

export async function listCategoriesController(_req: Request, res: Response) {
  res.json(await listAdminCategories());
}

export async function createCategoryController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(categorySchema, req.body);
  res.status(201).json(await createCategory(me, body));
}

export async function updateCategoryController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Category');
  const body = parse(categorySchema, req.body);
  res.json(await updateCategory(me, id, body));
}

export async function deleteCategoryController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Category');
  res.json(await deleteCategory(me, id));
}

// ---------- products ----------

export async function listProductsController(req: Request, res: Response) {
  res.json(await listAdminProducts(query(req)));
}

export async function getProductController(req: Request, res: Response) {
  res.json(await getAdminProduct(idParam(req.params.id, 'Product')));
}

export async function createProductController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(productSchema, req.body);
  res.status(201).json(await createProduct(me, body));
}

export async function updateProductController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Product');
  const body = parse(productSchema, req.body);
  res.json(await updateProduct(me, id, body));
}

export async function patchProductController(req: Request, res: Response) {
  const id = idParam(req.params.id, 'Product');
  const body = parse(productPatchSchema, req.body);
  res.json(await patchProduct(id, body));
}

export async function deleteProductController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Product');
  res.json(await deleteProduct(me, id));
}

export async function importProductsController(req: Request, res: Response) {
  const me = currentUser(req);
  res.json(await importProducts(me, files(req)));
}

export async function localizeImagesController(req: Request, res: Response) {
  const me = currentUser(req);
  res.json(await localizeImages(me, req.query.limit));
}

// ---------- pages & posts ----------

export async function listPagesController(_req: Request, res: Response) {
  res.json(await listAdminPages());
}

export async function createPageController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(pageSchema, req.body);
  res.status(201).json(await createPage(me, body));
}

export async function updatePageController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Page');
  const body = parse(pageSchema, req.body);
  res.json(await updatePage(me, id, body));
}

export async function deletePageController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Page');
  res.json(await deletePage(me, id));
}

export async function listPostsController(req: Request, res: Response) {
  res.json(await listAdminPosts(query(req)));
}

export async function createPostController(req: Request, res: Response) {
  const me = currentUser(req);
  const body = parse(postSchema, req.body);
  res.status(201).json(await createPost(me, body));
}

export async function updatePostController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Post');
  const body = parse(postSchema, req.body);
  res.json(await updatePost(me, id, body));
}

export async function deletePostController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Post');
  res.json(await deletePost(me, id));
}

// ---------- enquiries ----------

export async function listEnquiriesController(req: Request, res: Response) {
  res.json(await listEnquiries(query(req)));
}

export async function updateEnquiryController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Enquiry');
  const body = parse(enquiryUpdateSchema, req.body);
  res.json(await updateEnquiry(me, id, body));
}

export async function deleteEnquiryController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Enquiry');
  res.json(await deleteEnquiry(me, id));
}

export async function enquiryFileController(req: Request, res: Response) {
  const file = await getEnquiryFile(idParam(req.params.id, 'Enquiry'), String(req.params.storedName));
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.set('Content-Disposition', `${file.inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.originalName)}"`);
  res.type(file.inline ? file.mimeType : 'application/octet-stream').sendFile(file.path, (err) => { if (err && !res.headersSent) res.status(404).end(); });
}

// ---------- reviews ----------

export async function listReviewsController(req: Request, res: Response) {
  res.json(await listReviews(query(req)));
}

export async function updateReviewController(req: Request, res: Response) {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Review');
  const body = parse(reviewUpdateSchema, req.body);
  res.json(await updateReview(me, id, body));
}

export async function deleteReviewController(req: Request, res: Response) {
  res.json(await deleteReview(idParam(req.params.id, 'Review')));
}

// ---------- subscribers ----------

export async function listSubscribersController(req: Request, res: Response) {
  res.json(await listSubscribers(query(req)));
}

export async function exportSubscribersController(_req: Request, res: Response) {
  const csv = await exportSubscribersCsv();
  res.set('Content-Disposition', 'attachment; filename="sns-subscribers.csv"');
  res.type('text/csv').send(csv);
}

export async function deleteSubscriberController(req: Request, res: Response) {
  res.json(await deleteSubscriber(idParam(req.params.id, 'Subscriber')));
}
