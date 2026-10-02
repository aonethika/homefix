import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { storageService } from '../services/storage.service.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many upload requests. Please wait 15 minutes before trying again.' } });
router.post('/presign', limiter, async (req, res, next) => {
  try {
    const ticket = await storageService.presign(req.body, req.get('X-Upload-Session'));
    res.set('Cache-Control', 'no-store').json({ success: true, data: ticket });
  } catch (error) { next(error); }
});
export default router;
