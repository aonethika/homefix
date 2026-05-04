import { Router } from 'express';
import { createOrder, verifyPayment, getPayment } from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('USER', 'ADMIN'));

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/:requestId', getPayment);

export default router;
