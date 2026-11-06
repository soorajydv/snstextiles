import type { Request, Response } from 'express';
import { buildOrdersCsv, getAttendanceReport, getPaymentsReport, getSummary } from './reports.service';

export async function summaryController(req: Request, res: Response) {
  res.json(await getSummary(req.query.months));
}

export async function attendanceReportController(req: Request, res: Response) {
  res.json(await getAttendanceReport(req.query));
}

export async function paymentsReportController(req: Request, res: Response) {
  res.json(await getPaymentsReport(req.query));
}

export async function ordersCsvController(_req: Request, res: Response) {
  const csv = await buildOrdersCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
}
