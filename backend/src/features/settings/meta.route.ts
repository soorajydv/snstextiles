import { Router } from 'express';
import { metaController } from './settings.controller';

/** Static option lists so the frontend never hard-codes business vocabulary. */
export const metaRouter = Router();
metaRouter.get('/', metaController);
