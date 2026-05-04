import { Router } from 'express';
import { register, login, getProfile, updateProfile } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getProfile);
router.patch('/me', authenticate, updateProfile);

export default router;
