import { Router } from 'express';
import { OrderController } from '../controllers/OrderController.js';
import { validateBody } from '../middlewares/validate.js';
import { createOrderSchema } from '../validators/orderSchemas.js';

const router = Router();

// Order Creation Path
router.post('/', validateBody(createOrderSchema), OrderController.create);

export const orderRoutes = router;