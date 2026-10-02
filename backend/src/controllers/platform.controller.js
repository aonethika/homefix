import prisma from '../lib/prisma.js';
import { notifyAdmins } from '../services/notification.service.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.serviceCategory.findMany({ where: { status: 'APPROVED' }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error) { next(error); }
};

export const getNotifications = async (req, res, next) => {
  try {
    const items = await prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: items });
  } catch (error) { next(error); }
};

export const markNotificationsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

export const createComplaint = async (req, res, next) => {
  try {
    const { subject, message, requestId } = req.body;
    if (!subject?.trim() || !message?.trim()) return res.status(400).json({ success: false, message: 'Subject and details are required' });
    if (requestId) {
      const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
      if (!request || (request.userId !== req.user.id && request.workerId !== req.user.workerProfile?.id)) return res.status(403).json({ success: false, message: 'Invalid booking' });
    }
    const complaint = await prisma.complaint.create({ data: { authorId: req.user.id, requestId: requestId || null, subject: subject.trim(), message: message.trim() } });
    await notifyAdmins('New complaint', `${req.user.name}: ${subject.trim()}`, 'WARNING', { complaintId: complaint.id });
    res.status(201).json({ success: true, data: complaint });
  } catch (error) { next(error); }
};

export const submitAppRating = async (req, res, next) => {
  try {
    const score = Number(req.body.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ success: false, message: 'Choose a rating from 1 to 5' });
    const rating = await prisma.appRating.create({ data: { userId: req.user.id, score, comment: req.body.comment?.trim() || null } });
    await notifyAdmins('New app feedback', `${req.user.name} rated Zoon ${score}/5.`, 'INFO', { appRatingId: rating.id });
    res.status(201).json({ success: true, data: rating });
  } catch (error) { next(error); }
};
