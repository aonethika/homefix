import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { getOverview, getWorkerDocument, rerunWorkerKyc, reviewWorker, reviewCategory, updateComplaint } from '../controllers/admin.controller.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));
router.get('/overview', getOverview);
router.get('/workers/:id/document', getWorkerDocument);
router.post('/workers/:id/kyc/rerun', rerunWorkerKyc);
router.patch('/workers/:id', reviewWorker);
router.patch('/categories/:id', reviewCategory);
router.patch('/complaints/:id', updateComplaint);
export default router;
