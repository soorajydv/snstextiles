import fs from 'fs';
import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { assertObjectId, badRequest, parse } from '../../lib/http';
import { compressUploadedImage, removeUploadedFiles } from '../../lib/uploads';
import {
  addFeedback, advanceStage, approveArtwork, completeCutting, createOrder, deleteOrder, deliverOrder, getOrder, getOrderFile,
  issueInvoice, listOrders, sendBack, updateOrder, uploadArtwork, type OrderUploads,
} from './orders.service';
import { createSchema, normaliseSpec } from './orders.validation';

function parseMultipartData(req: Request) {
  if (typeof req.body?.data === 'string') {
    try {
      return JSON.parse(req.body.data);
    } catch {
      throw badRequest('Malformed order data');
    }
  }
  return req.body;
}

export async function listOrdersController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await listOrders(user, req.query as Record<string, unknown>));
}

export async function getOrderController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await getOrder(user, assertObjectId(req.params.id, 'Order')));
}

export async function createOrderController(req: Request, res: Response) {
  const user = currentUser(req);
  const uploaded = req.files as OrderUploads;
  const allUploads = [...(uploaded?.jerseyImage ?? []), ...(uploaded?.files ?? []), ...(uploaded?.advanceProof ?? []), ...(uploaded?.playerListImage ?? [])];
  try {
    await Promise.all(allUploads.map(compressUploadedImage));
    const body = normaliseSpec(parse(createSchema, parseMultipartData(req)));
    res.status(201).json(await createOrder(user, body, uploaded));
  } catch (err) {
    removeUploadedFiles(allUploads);
    throw err;
  }
}

export async function updateOrderController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await updateOrder(user, req.params.id, req.body));
}

export async function deleteOrderController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await deleteOrder(user, req.params.id));
}

export async function uploadArtworkController(req: Request, res: Response) {
  const user = currentUser(req);
  try {
    res.status(201).json(await uploadArtwork(user, req.params.id, req.file, req.body?.note));
  } catch (err) {
    removeUploadedFiles(req.file ? [req.file] : []);
    throw err;
  }
}

export async function approveArtworkController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await approveArtwork(user, req.params.id, req.body));
}

export async function feedbackController(req: Request, res: Response) {
  const user = currentUser(req);
  res.status(201).json(await addFeedback(user, req.params.id, req.body));
}

export async function advanceStageController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await advanceStage(user, req.params.id, req.body));
}

export async function completeCuttingController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await completeCutting(user, req.params.id));
}

export async function sendBackController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await sendBack(user, req.params.id, req.body));
}

export async function deliverOrderController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await deliverOrder(user, req.params.id, req.body));
}

export async function issueInvoiceController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await issueInvoice(user, req.params.id));
}

export async function orderFileController(req: Request, res: Response) {
  const user = currentUser(req);
  const file = await getOrderFile(user, req.params.id, String(req.params.storedName), req.query.download !== undefined);
  res.setHeader('Content-Type', file.inline ? file.mimeType : 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', `${file.inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.originalName)}"`);
  fs.createReadStream(file.filePath).pipe(res);
}
