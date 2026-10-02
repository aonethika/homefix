import { AuthService } from './auth.service.js';
import prisma from '../lib/prisma.js';

export class WorkerService {
  async toggleAvailability(userId) {
    const profile = await prisma.workerProfile.findUnique({ where: { userId } });
    if (!profile) throw Object.assign(new Error('Worker profile not found'), { status: 404 });
    if (profile.applicationStatus !== 'APPROVED') throw Object.assign(new Error('Your professional application is awaiting approval'), { status: 403 });

    return prisma.workerProfile.update({
      where: { userId },
      data: { isAvailable: !profile.isAvailable },
    });
  }

  async updateLocation(userId, latitude, longitude, address) {
    return prisma.workerProfile.update({
      where: { userId },
      data: { latitude, longitude, address },
    });
  }

  async getWorkerStats(userId) {
    const profile = await prisma.workerProfile.findUnique({
      where: { userId },
      include: {
        requests: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
        },
        ratingsReceived: true,
      },
    });
    if (!profile) throw Object.assign(new Error('Worker profile not found'), { status: 404 });

    const completedJobs = profile.requests.filter(r => ['PAID', 'COMPLETED'].includes(r.status));
    const totalEarnings = profile.requests
      .filter(r => r.payment?.status === 'PAID')
      .reduce((sum, r) => sum + (r.finalPrice || 0), 0);
    const avgRating = profile.ratingsReceived.length
      ? profile.ratingsReceived.reduce((s, r) => s + r.score, 0) / profile.ratingsReceived.length
      : 0;

    return {
      profile: new AuthService().sanitizeUser({ workerProfile: profile }).workerProfile,
      stats: {
        totalJobs: completedJobs.length,
        totalEarnings,
        avgRating,
        pendingJobs: profile.requests.filter(r => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)).length,
      },
    };
  }

  async getAllWorkers(filters = {}) {
    return prisma.workerProfile.findMany({
      where: { ...filters, isPublic: true, applicationStatus: 'APPROVED' },
      select: { id: true, userId: true, serviceType: true, serviceKey: true, isAvailable: true, panVerified: true, faceVerified: true, rating: true, totalJobs: true, bio: true, _count: { select: { ratingsReceived: true } }, user: { select: { id: true, name: true } }, services: { where: { category: { status: 'APPROVED' } }, include: { category: { select: { key: true, name: true, icon: true } } } } },
      orderBy: [{ isAvailable: 'desc' }, { panVerified: 'desc' }, { faceVerified: 'desc' }, { rating: 'desc' }, { totalJobs: 'desc' }],
    });
  }

  async updateProfile(userId, data) {
    const updates = {};
    for (const [key, limit] of [['bio', 2000], ['address', 300]]) {
      if (data[key] !== undefined) {
        if (typeof data[key] !== 'string' || data[key].length > limit) throw Object.assign(new Error(`Invalid ${key}`), { status: 400 });
        updates[key] = data[key].trim();
      }
    }
    if (data.isPublic !== undefined) {
      if (typeof data.isPublic !== 'boolean') throw Object.assign(new Error('Invalid visibility'), { status: 400 });
      updates.isPublic = data.isPublic;
    }
    if (data.phone !== undefined && (typeof data.phone !== 'string' || data.phone.length > 30)) throw Object.assign(new Error('Invalid phone'), { status: 400 });
    const profile = await prisma.workerProfile.update({ where: { userId }, data: { ...updates, user: { update: { phone: data.phone } } } });
    return new AuthService().sanitizeUser({ workerProfile: profile }).workerProfile;
  }
}
