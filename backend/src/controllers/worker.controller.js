import { WorkerService } from '../services/worker.service.js';
import { RequestService } from '../services/request.service.js';
import { ChatService } from '../services/chat.service.js';

const workerService = new WorkerService();
const requestService = new RequestService();
const chatService = new ChatService();

export const toggleAvailability = async (req, res, next) => {
  try {
    const profile = await workerService.toggleAvailability(req.user.id);
    res.json({ success: true, data: { isAvailable: profile.isAvailable } });
  } catch (err) { next(err); }
};

export const updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, address } = req.body;
    const profile = await workerService.updateLocation(req.user.id, latitude, longitude, address);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
};

export const getMyRequests = async (req, res, next) => {
  try {
    const workerId = req.user.workerProfile?.id;
    if (!workerId) return res.status(403).json({ success: false, message: 'Not a worker' });
    const requests = await requestService.getWorkerRequests(workerId);
    res.json({ success: true, data: requests });
  } catch (err) { next(err); }
};

export const acceptRequest = async (req, res, next) => {
  try {
    const workerId = req.user.workerProfile?.id;
    if (!workerId) return res.status(403).json({ success: false, message: 'Not a worker' });
    const request = await requestService.acceptRequest(req.params.requestId, workerId);
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

export const rejectRequest = async (req, res, next) => {
  try {
    const workerId = req.user.workerProfile?.id;
    if (!workerId) return res.status(403).json({ success: false, message: 'Not a worker' });
    const request = await requestService.rejectRequest(req.params.requestId, workerId);
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

export const updateJobStatus = async (req, res, next) => {
  try {
    const workerId = req.user.workerProfile?.id;
    if (!workerId) return res.status(403).json({ success: false, message: 'Not a worker' });
    const { status } = req.body;
    const allowed = ['IN_PROGRESS', 'COMPLETED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const request = await requestService.updateStatus(req.params.requestId, workerId, status);
    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

export const setPrice = async (req, res, next) => {
  try {
    const workerId = req.user.workerProfile?.id;
    if (!workerId) return res.status(403).json({ success: false, message: 'Not a worker' });
    const { price } = req.body;
    const request = await requestService.setPrice(req.params.requestId, workerId, price);

    // Notify chat session
    if (request.sessionId) {
      await chatService.handlePriceNotification(
        request.sessionId,
        price,
        req.user.name
      );
    }

    res.json({ success: true, data: request });
  } catch (err) { next(err); }
};

export const getStats = async (req, res, next) => {
  try {
    const data = await workerService.getWorkerStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getAllWorkers = async (req, res, next) => {
  try {
    const { serviceType, isAvailable } = req.query;
    const filters = {};
    if (serviceType) filters.serviceType = serviceType;
    if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';
    const workers = await workerService.getAllWorkers(filters);
    res.json({ success: true, data: workers });
  } catch (err) { next(err); }
};
