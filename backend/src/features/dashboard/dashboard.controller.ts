import type { Request, Response } from 'express';
import { currentUser } from '../../middleware/auth';
import { getDashboard } from './dashboard.service';

export async function dashboardController(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await getDashboard(user, req.query.recentOrdersSort));
}
