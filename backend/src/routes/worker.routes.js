import { Router } from 'express';
import {
  toggleAvailability, updateLocation, getMyRequests,
  acceptRequest, rejectRequest, updateJobStatus, setPrice, getStats, getAllWorkers
} from '../controllers/worker.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

router.get('/', getAllWorkers); // Public - list workers

router.use(authenticate);

// Worker-only routes
router.post('/availability', requireRole('WORKER'), toggleAvailability);
router.patch('/location', requireRole('WORKER'), updateLocation);
router.get('/requests', requireRole('WORKER'), getMyRequests);
router.get('/stats', requireRole('WORKER'), getStats);
router.post('/requests/:requestId/accept', requireRole('WORKER'), acceptRequest);
router.post('/requests/:requestId/reject', requireRole('WORKER'), rejectRequest);
router.patch('/requests/:requestId/status', requireRole('WORKER'), updateJobStatus);
router.post('/requests/:requestId/price', requireRole('WORKER'), setPrice);

export default router;
