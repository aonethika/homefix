import { Router } from 'express';
import { sendMessage, createSession, getSession, getUserSessions } from '../controllers/chat.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('USER', 'ADMIN'));

router.post('/message', sendMessage);
router.post('/session', createSession);
router.get('/sessions', getUserSessions);
router.get('/session/:sessionId', getSession);

export default router;
