import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { assertObjectId, parse } from '../../lib/http';
import { compressUploadedImage, removeUploadedFiles } from '../../lib/uploads';
import { createPayment, deletePayment, getPaymentProof, listPayments, rejectPayment, verifyPayment } from './payments.service';
import { createSchema, rejectSchema } from './payments.validation';

export async function listPaymentsController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await listPayments(user, req.query as Record<string, unknown>));
}

export async function createPaymentController(req: Request, res: Response) {
  const user = currentUser(req);
  const uploaded = req.file;
  try {
    if (uploaded) await compressUploadedImage(uploaded);
    const body = parse(createSchema, req.body);
    res.status(201).json(await createPayment(user, body, uploaded));
  } catch (error) {
    removeUploadedFiles(uploaded ? [uploaded] : undefined);
    throw error;
  }
}

export async function verifyPaymentController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await verifyPayment(user, assertObjectId(req.params.id, 'Payment')));
}

export async function rejectPaymentController(req: Request, res: Response) {
  const user = currentUser(req);
  const { reason } = parse(rejectSchema, req.body ?? {});
  res.json(await rejectPayment(user, assertObjectId(req.params.id, 'Payment'), reason));
}

export async function paymentProofController(req: Request, res: Response) {
  const user = currentUser(req);
  const file = await getPaymentProof(user, assertObjectId(req.params.id, 'Payment'));
  res.type(file.mimeType).sendFile(file.path, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
}

export async function deletePaymentController(req: Request, res: Response) {
  const user = currentUser(req);
  const id = assertObjectId(req.params.id, 'Payment');
  res.json(await deletePayment(user, id));
}
