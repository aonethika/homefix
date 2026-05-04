import { Router } from 'express';
import { getMyRequests, getRequest, getAllRequests, cancelRequest } from '../controllers/request.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', getAllRequests);
router.get('/my', getMyRequests);
router.get('/:id', getRequest);
router.post('/:id/cancel', cancelRequest);

export default router;
