import { chatLifecycle } from '../services/chat-lifecycle.service.js';
import { bookingService } from '../services/booking.service.js';
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
    if (serviceType) filters.OR = ['PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'].includes(serviceType)
      ? [{ serviceKey: serviceType }, { serviceType }]
      : [{ serviceKey: serviceType }];
    const requests = await requestService.getAllRequests(filters);
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
};

export const cancelRequest = async (req, res, next) => {
  try {
    const direct = await requestService.getRequestById(req.params.id);
    if (direct?.bookingStage) return res.json({ success: true, data: await bookingService.change(req.params.id, req.user, 'cancel', req.body) });
    const result = await chatLifecycle.stop({ userId: req.user.id, requestId: req.params.id, expectedStatus: req.body.expectedStatus, pendingOnly: req.body.pendingOnly === true, actorRole: req.user.role, reason: req.body.reason });
    res.json({ success: true, data: result.request });
  } catch (err) { next(err); }
};

export const sendRequestMessage = async (req, res, next) => {
  try {
    const message = await requestService.sendMessage(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
};

export const bookAppointment = async (req, res, next) => {
  try {
    if (req.user.role !== 'USER') return res.status(403).json({ success: false, message: 'Sign in as a homeowner to book' });
    res.status(201).json({ success: true, data: await requestService.bookAppointment(req.user.id, req.body) });
  } catch (error) {
    if (error.code === 'P2034') return res.status(409).json({ success: false, message: 'The schedule changed. Please try again.' });
    next(error);
  }
};

export const scheduleAppointment = async (req, res, next) => {
  try { res.json({ success: true, data: await bookingService.change(req.params.id, req.user, "schedule", req.body) }); } catch (err) { next(err); }
};

export const rescheduleAppointment = async (req, res, next) => {
  try { res.json({ success: true, data: await bookingService.change(req.params.id, req.user, 'reschedule', req.body) }); } catch (err) { next(err); }
};

export const getTracking = async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (request.userId !== req.user.id && request.worker?.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { getRequestLocation } = await import('../socket/socket.js');
    const available = ['ACCEPTED', 'IN_PROGRESS'].includes(request.status) && request.bookingStage !== 'READY';
    res.json({ success: true, data: { status: request.status, location: available ? getRequestLocation(request.id) : null } });
  } catch (error) { next(error); }
};
