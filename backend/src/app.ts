import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './features/auth/auth.route';
import userRoutes from './features/users/users.route';
import customerRoutes from './features/customers/customers.route';
import orderRoutes from './features/orders/orders.route';
import paymentRoutes from './features/payments/payments.route';
import inventoryRoutes from './features/inventory/inventory.route';
import dashboardRoutes from './features/dashboard/dashboard.route';
import reportRoutes from './features/reports/reports.route';
import { settingsRouter } from './features/settings/settings.route';
import { metaRouter } from './features/settings/meta.route';
import { auditRouter } from './features/audit/audit.route';
import attendanceRoutes from './features/attendance/attendance.route';
import roleRoutes from './features/roles/roles.route';
import publicSiteRoutes from './features/site/site.public.route';
import favoriteRoutes from './features/favorites/favorite.route';
import adminSiteRoutes from './features/site/site.admin.route';
import { getLogoController } from './features/settings/settings.controller';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // The login page needs the business logo before a user has authenticated.
  app.get('/api/public/business-logo', getLogoController);

  app.use('/api/auth', authRoutes);
  // Public website: catalogue, content, enquiry forms and the signed-in checkout.
  app.use('/api/public/site', publicSiteRoutes);
  app.use('/api/public/site/favorites', favoriteRoutes);

  const api = express.Router();
  api.use(requireAuth);
  api.use('/meta', metaRouter);
  api.use('/dashboard', dashboardRoutes);
  api.use('/attendance', attendanceRoutes);
  api.use('/roles', roleRoutes);
  api.use('/orders', orderRoutes);
  api.use('/customers', customerRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/inventory', inventoryRoutes);
  api.use('/reports', reportRoutes);
  api.use('/users', userRoutes);
  api.use('/settings', settingsRouter);
  api.use('/audit', auditRouter);
  api.use('/site', adminSiteRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
