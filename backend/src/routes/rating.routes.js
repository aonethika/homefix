import { Router } from 'express';
import { submitRating, getWorkerRatings } from '../controllers/rating.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

router.get('/worker/:workerId', getWorkerRatings);
router.post('/', authenticate, requireRole('USER'), submitRating);

export default router;
