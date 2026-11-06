import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './features/auth/auth.route';
import userRoutes from './routes/users';
import customerRoutes from './routes/customers';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import inventoryRoutes from './routes/inventory';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import { auditRouter, metaRouter, settingsRouter } from './routes/settings';
import attendanceRoutes from './features/attendance/attendance.route';
import roleRoutes from './routes/roles';
import publicSiteRoutes from './features/site/site.public.route';
import adminSiteRoutes from './features/site/site.admin.route';
import { getSettings } from './models/Settings';
import { storedFilePath } from './lib/uploads';

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
  app.get('/api/public/business-logo', async (_req, res) => {
    const settings = await getSettings();
    if (!settings.logoStoredName) { res.status(404).end(); return; }
    res.type(settings.logoMimeType ?? 'application/octet-stream').sendFile(storedFilePath(settings.logoStoredName), (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  app.use('/api/auth', authRoutes);
  // Public website: catalogue, content, enquiry forms and the signed-in checkout.
  app.use('/api/public/site', publicSiteRoutes);

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
