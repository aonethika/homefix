import { AuthService } from '../services/auth.service.js';
import { WorkerService } from '../services/worker.service.js';
import { RequestService } from '../services/request.service.js';

const workerService = new WorkerService();
const requestService = new RequestService();

export const toggleAvailability = async (req, res, next) => {
  try {
    const profile = await workerService.toggleAvailability(req.user.id);
    res.json({ success: true, data: { isAvailable: profile.isAvailable } });
  } catch (err) { next(err); }
};

export const updateLocation = async (req, res, next) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ success: false, message: 'Invalid location' });
    const profile = await workerService.updateLocation(req.user.id, latitude, longitude, req.body.address);
    res.json({ success: true, data: new AuthService().sanitizeUser({ workerProfile: profile }).workerProfile });
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
    const price = Number(req.body.price);
    const request = await requestService.setPrice(req.params.requestId, workerId, price);

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
    if (serviceType) {
      filters.OR = [{ serviceKey: serviceType }, { services: { some: { category: { key: serviceType, status: 'APPROVED' } } } }];
      if (['PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'].includes(serviceType)) filters.OR.push({ serviceType });
    }
    filters.applicationStatus = 'APPROVED';
    filters.isPublic = true;
    if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';
    const workers = await workerService.getAllWorkers(filters);
    res.json({ success: true, data: workers });
  } catch (err) { next(err); }
};

export const updateProfile = async (req, res, next) => {
  try { res.json({ success: true, data: await workerService.updateProfile(req.user.id, req.body) }); }
  catch (error) { next(error); }
};
