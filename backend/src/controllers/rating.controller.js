import prisma from '../lib/prisma.js';
import { sendNotification, notifyAdmins } from '../services/notification.service.js';

export const submitRating = async (req, res, next) => {
  try {
    const { requestId, comment } = req.body;
    const score = Number(req.body.score);
    if (!requestId || !Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Invalid rating data' });
    }

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { worker: { include: { user: true } } },
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (!request.workerId) return res.status(400).json({ success: false, message: 'No professional was assigned' });
    if (!['PAID', 'COMPLETED'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Cannot rate before payment' });
    }

    const existing = await prisma.rating.findUnique({ where: { requestId } });
    if (existing) return res.status(409).json({ success: false, message: 'Already rated' });

    const rating = await prisma.rating.create({
      data: {
        requestId,
        raterId: req.user.id,
        workerId: request.workerId,
        score,
        comment,
      },
    });

    // Update worker average rating
    const allRatings = await prisma.rating.findMany({ where: { workerId: request.workerId } });
    const avgRating = allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length;
    await prisma.workerProfile.update({
      where: { id: request.workerId },
      data: { rating: avgRating, totalJobs: { increment: 1 }, isAvailable: true },
    });

    // Mark request completed
    await prisma.serviceRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED' } });
    await sendNotification(request.worker.userId, 'New rating received', `You received a ${score}-star rating.`, 'SUCCESS', { requestId, score });
    await notifyAdmins('Rating submitted', `A ${score}-star rating was submitted.`, 'INFO', { requestId, score });

    res.status(201).json({ success: true, data: rating });
  } catch (err) { next(err); }
};

export const getWorkerRatings = async (req, res, next) => {
  try {
    const visible = await prisma.workerProfile.findFirst({ where: { id: req.params.workerId, isPublic: true, applicationStatus: 'APPROVED' }, select: { id: true } });
    if (!visible) return res.status(404).json({ success: false, message: 'Public profile not found' });
    const ratings = await prisma.rating.findMany({
      where: { workerId: req.params.workerId },
      include: { rater: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: ratings });
  } catch (err) { next(err); }
};
