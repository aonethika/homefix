import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { getCategories, getNotifications, markNotificationsRead, createComplaint, submitAppRating } from '../controllers/platform.controller.js';

const router = Router();
router.get('/categories', getCategories);
router.get('/notifications', authenticate, getNotifications);
router.post('/notifications/read', authenticate, markNotificationsRead);
router.post('/complaints', authenticate, createComplaint);
router.post('/app-ratings', authenticate, submitAppRating);
export default router;
