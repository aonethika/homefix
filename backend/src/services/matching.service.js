import prisma from '../lib/prisma.js';
import { calculateDistance, distanceScore } from '../utils/distance.js';

export class MatchingService {
  /**
   * Find and score available workers for a service request
   */
  async findBestWorker(serviceType, userLat, userLon, maxDistanceKm = 25) {
    const workers = await prisma.workerProfile.findMany({
      where: {
        serviceType,
        isAvailable: true,
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        _count: { select: { requests: { where: { status: { in: ['ACCEPTED', 'IN_PROGRESS'] } } } } },
      },
    });

    if (workers.length === 0) return null;

    // Score each worker
    const scored = workers.map(worker => {
      const wLat = worker.latitude ?? 0;
      const wLon = worker.longitude ?? 0;
      const distance = (userLat && userLon) ? calculateDistance(userLat, userLon, wLat, wLon) : 10;

      if (distance > maxDistanceKm) return null;

      const dScore = distanceScore(distance, maxDistanceKm);
      const ratingScore = worker.rating / 5;
      const workloadScore = Math.max(0, 1 - (worker._count.requests * 0.2));

      // Weighted composite score
      const totalScore = (dScore * 0.5) + (ratingScore * 0.3) + (workloadScore * 0.2);

      return { worker, distance, score: totalScore };
    }).filter(Boolean);

    if (scored.length === 0) return null;

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0].worker;
  }

  /**
   * Get all available workers for a service type with distances
   */
  async getNearbyWorkers(serviceType, userLat, userLon, maxDistanceKm = 25) {
    const workers = await prisma.workerProfile.findMany({
      where: { serviceType, isAvailable: true },
      include: { user: { select: { id: true, name: true } } },
    });

    return workers
      .map(w => ({
        ...w,
        distance: (userLat && userLon && w.latitude && w.longitude)
          ? calculateDistance(userLat, userLon, w.latitude, w.longitude)
          : null,
      }))
      .filter(w => w.distance === null || w.distance <= maxDistanceKm)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }
}
