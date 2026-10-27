import { Router } from 'express';
import { OrderController } from '../controllers/OrderController.js';

const router = Router();

// Order Creation Path
router.post('/', OrderController.create);

export const orderRoutes = router;