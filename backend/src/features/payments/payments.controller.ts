import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { assertObjectId, parse } from '../../lib/http';
import { compressUploadedImage, removeUploadedFiles } from '../../lib/uploads';
import {
  createPayment, deletePayment, exportInvoicesCsv, exportPaymentsCsv, exportStatementCsv, getBillingSummary, getPaymentProof, listPayments,
  rejectPayment, verifyPayment,
} from './payments.service';
import { billingQuerySchema, createSchema, rejectSchema } from './payments.validation';

function sendCsv(res: Response, filename: string, csv: string) {
  const safeName = filename.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send('﻿' + csv);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function billingSummaryController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await getBillingSummary(user, parse(billingQuerySchema, req.query)));
}

export async function exportInvoicesController(req: Request, res: Response) {
  const user = currentUser(req);
  sendCsv(res, `orders-invoices-${stamp()}.csv`, await exportInvoicesCsv(user, parse(billingQuerySchema, req.query)));
}

export async function exportPaymentsController(req: Request, res: Response) {
  const user = currentUser(req);
  sendCsv(res, `payments-${stamp()}.csv`, await exportPaymentsCsv(user, parse(billingQuerySchema, req.query)));
}

export async function exportStatementController(req: Request, res: Response) {
  const user = currentUser(req);
  const statement = await exportStatementCsv(user, parse(billingQuerySchema, req.query));
  sendCsv(res, `statement-${statement.customerName}-${stamp()}.csv`, statement.csv);
}

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
