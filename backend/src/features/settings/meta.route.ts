import { Router } from 'express';
import { currentUser } from '../../middleware/auth';
import {
  DELIVERY_METHODS, NECK_TYPES, PAYMENT_METHODS, PERMISSIONS, PRODUCT_CONFIGS, SIZES, SLEEVES, STAGE_LABELS, STAGES,
} from '../../lib/constants';
import { listRoles, permissionsForUserRole } from '../roles/roles.service';
import { INVENTORY_CATEGORIES } from '../inventory/inventory.model';

/** Static option lists so the frontend never hard-codes business vocabulary. */
export const metaRouter = Router();
metaRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  res.json({
    roles: (await listRoles()).map((role) => ({ key: role.key, name: role.name, description: role.description ?? '', permissions: role.permissions ?? [], system: role.system })),
    stages: STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] })),
    productConfigs: PRODUCT_CONFIGS,
    neckTypes: NECK_TYPES,
    sleeves: SLEEVES,
    sizes: SIZES.filter(Boolean),
    paymentMethods: PAYMENT_METHODS,
    deliveryMethods: DELIVERY_METHODS,
    inventoryCategories: INVENTORY_CATEGORIES,
    permissions: await permissionsForUserRole(user.role),
    availablePermissions: PERMISSIONS,
  });
});
