import prisma from '../lib/prisma.js';

export class WorkerService {
  async toggleAvailability(userId) {
    const profile = await prisma.workerProfile.findUnique({ where: { userId } });
    if (!profile) throw Object.assign(new Error('Worker profile not found'), { status: 404 });

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

    const completedJobs = profile.requests.filter(r => r.status === 'COMPLETED');
    const totalEarnings = completedJobs.reduce((sum, r) => sum + (r.finalPrice || 0), 0);
    const avgRating = profile.ratingsReceived.length
      ? profile.ratingsReceived.reduce((s, r) => s + r.score, 0) / profile.ratingsReceived.length
      : 0;

    return {
      profile,
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
      where: filters,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { rating: 'desc' },
    });
  }

  async updateProfile(userId, data) {
    return prisma.workerProfile.update({
      where: { userId },
      data: {
        bio: data.bio,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
      },
    });
  }
}
