import { Router } from 'express';
import { getTracking, rescheduleAppointment, scheduleAppointment, bookAppointment, getMyRequests, getRequest, getAllRequests, cancelRequest, sendRequestMessage } from '../controllers/request.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.post('/appointments', bookAppointment);
router.get('/', getAllRequests);
router.get('/my', getMyRequests);
router.get('/:id/tracking', getTracking);
router.get('/:id', getRequest);
router.post('/:id/reschedule', rescheduleAppointment);
router.post('/:id/schedule', scheduleAppointment);
router.post('/:id/cancel', cancelRequest);
router.post('/:id/messages', sendRequestMessage);

export default router;
