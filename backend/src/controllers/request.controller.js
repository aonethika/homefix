import { RequestService } from '../services/request.service.js';

const requestService = new RequestService();

export const getMyRequests = async (req, res, next) => {
  try {
    const requests = await requestService.getUserRequests(req.user.id);
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
};

export const getRequest = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    // Authorization check
    if (request.userId !== req.user.id && request.worker?.user?.id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

export const getAllRequests = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const { status, serviceType } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (serviceType) filters.serviceType = serviceType;
    const requests = await requestService.getAllRequests(filters);
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
};

export const cancelRequest = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { PrismaClient } = await import('@prisma/client');
    const prisma = (await import('../lib/prisma.js')).default;
    const updated = await prisma.serviceRequest.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};
