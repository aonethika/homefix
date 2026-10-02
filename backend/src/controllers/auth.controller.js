import { AuthService } from '../services/auth.service.js';
import { notifyAdmins } from '../services/notification.service.js';

const authService = new AuthService();

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const registerProfessional = async (req, res, next) => {
  try {
    const result = await authService.registerProfessional(req.body, req.get('X-Upload-Session'));
    await notifyAdmins('Professional application ready for review', `${result.user.name} submitted a professional application. Review the automatic checks and private documents.`, 'APPLICATION', { workerId: result.user.workerProfile?.id }).catch(() => {});
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const requestPasswordOtp = async (req, res, next) => {
  try { res.json({ success: true, data: await authService.requestPasswordOtp(req.body.email) }); }
  catch (err) { next(err); }
};

export const resetPassword = async (req, res, next) => {
  try { res.json({ success: true, data: await authService.resetPassword(req.body) }); }
  catch (err) { next(err); }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
