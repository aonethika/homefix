import { Router } from 'express';
import { register, registerProfessional, login, getProfile, updateProfile, requestPasswordOtp, resetPassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/professional-register', registerProfessional);
router.post('/login', login);
router.post('/forgot-password', requestPasswordOtp);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, getProfile);
router.patch('/me', authenticate, updateProfile);

export default router;
