import prisma from '../lib/prisma.js';
import { sendNotification } from '../services/notification.service.js';
import { getWorkerDocumentUrls, verifyKyc } from '../services/kyc.service.js';

export const getOverview = async (req, res, next) => {
  try {
    const [users, workers, requests, complaints, ratings, categories, appRatings] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, address: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.workerProfile.findMany({
        select: {
          id: true,
          userId: true,
          serviceType: true,
          serviceKey: true,
          applicationStatus: true,
          applicationNote: true,
          panNumber: true,
          profilePhotoKey: true,
          panDocumentKey: true,
          faceFrontKey: true,
          faceLeftKey: true,
          faceRightKey: true,
          panVerified: true,
          faceVerified: true,
          kycReport: true,
          idDocumentName: true,
          idDocumentMime: true,
          isAvailable: true,
          isPublic: true,
          address: true,
          rating: true,
          totalJobs: true,
          bio: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
          services: { include: { category: { select: { id: true, key: true, name: true, status: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.serviceRequest.findMany({ include: { user: { select: { name: true, email: true } }, worker: { include: { user: { select: { name: true } } } }, payment: true, rating: true }, orderBy: { createdAt: 'desc' } }),
      prisma.complaint.findMany({ include: { author: { select: { name: true, email: true, role: true } }, request: { select: { id: true, description: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.rating.findMany({ include: { rater: { select: { name: true } }, worker: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
      prisma.serviceCategory.findMany({ include: { requestedBy: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.appRating.findMany({ include: { user: { select: { name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ success: true, data: { users, workers, requests, complaints, ratings, categories, appRatings } });
  } catch (error) { next(error); }
};

export const getWorkerDocument = async (req, res, next) => {
  try {
    const urls = await getWorkerDocumentUrls(req.params.id);
    if (!urls) return res.status(404).json({ success: false, message: 'Document not found' });
    res.set('Cache-Control', 'private, no-store').json({ success: true, data: urls });
  } catch (error) { next(error); }
};

export const rerunWorkerKyc = async (req, res, next) => {
  try {
    const worker = await prisma.workerProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true } } },
    });
    if (!worker) return res.status(404).json({ success: false, message: 'Professional not found' });
    if (!worker.profilePhotoKey || !worker.panDocumentKey || !worker.faceFrontKey || !worker.faceLeftKey || !worker.faceRightKey) {
      return res.status(400).json({ success: false, message: 'This application is missing one or more KYC files.' });
    }

    const verification = await verifyKyc({
      name: worker.user.name,
      panNumber: worker.panNumber,
      profilePhotoKey: worker.profilePhotoKey,
      panDocumentKey: worker.panDocumentKey,
      faceFrontKey: worker.faceFrontKey,
      faceLeftKey: worker.faceLeftKey,
      faceRightKey: worker.faceRightKey,
    });
    const updated = await prisma.workerProfile.update({
      where: { id: worker.id },
      data: {
        ...(!verification.ok ? { applicationStatus: 'PENDING', isPublic: false } : {}),
        panVerified: verification.panVerified,
        faceVerified: verification.faceVerified,
        kycReport: verification.report,
        applicationNote: verification.ok ? verification.note : verification.errors.join(' '),
      },
      select: { id: true, panVerified: true, faceVerified: true, kycReport: true, applicationNote: true },
    });
    res.json({ success: true, data: updated, errors: verification.errors });
  } catch (error) { next(error); }
};

export const reviewWorker = async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid decision' });
    if (status === 'APPROVED') {
      const profile = await prisma.workerProfile.findUnique({ where: { id: req.params.id } });
      if (!profile) return res.status(404).json({ success: false, message: 'Professional not found.' });
      if (profile.kycReport?.errors?.length) return res.status(409).json({ success: false, message: 'Identity checks found a mismatch. Resolve it and rerun checks before approval.' });
      if ((!profile.panVerified || !profile.faceVerified || !profile.kycReport?.document?.passed) && (typeof req.body.note !== 'string' || req.body.note.trim().length < 20)) return res.status(400).json({ success: false, message: 'Record how you manually verified the documents and identity before approving (at least 20 characters).' });
      const pendingService = await prisma.workerService.findFirst({ where: { workerId: req.params.id, category: { status: { not: 'APPROVED' } } } });
      if (pendingService) return res.status(409).json({ success: false, message: 'Approve the requested service category before approving this professional' });
    }
    const worker = await prisma.workerProfile.update({ where: { id: req.params.id }, data: { applicationStatus: status, ...(typeof req.body.note === 'string' && req.body.note.trim() ? { applicationNote: req.body.note.trim().slice(0, 1000) } : {}) }, include: { user: true } });
    await sendNotification(worker.userId, `Professional application ${status.toLowerCase()}`, status === 'APPROVED' ? 'Your profile is approved. You can now receive jobs.' : (req.body.note || 'Your application needs changes.'), status, { workerId: worker.id });
    res.json({ success: true, data: { id: worker.id, applicationStatus: worker.applicationStatus, applicationNote: worker.applicationNote } });
  } catch (error) { next(error); }
};

export const reviewCategory = async (req, res, next) => {
  try {
    const status = String(req.body.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid decision' });
    const category = await prisma.serviceCategory.update({ where: { id: req.params.id }, data: { status }, include: { requestedBy: true } });
    if (category.requestedById) await sendNotification(category.requestedById, `Category ${status.toLowerCase()}`, `${category.name} was ${status.toLowerCase()} by zoon.`, status, { categoryId: category.id });
    res.json({ success: true, data: category });
  } catch (error) { next(error); }
};

export const updateComplaint = async (req, res, next) => {
  try {
    const allowed = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];
    const status = String(req.body.status || '').toUpperCase();
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid complaint status' });
    const complaint = await prisma.complaint.update({ where: { id: req.params.id }, data: { status, adminNote: req.body.adminNote || null } });
    await sendNotification(complaint.authorId, 'Complaint updated', `Your complaint is now ${status.replaceAll('_', ' ').toLowerCase()}.`, 'INFO', { complaintId: complaint.id });
    res.json({ success: true, data: complaint });
  } catch (error) { next(error); }
};
