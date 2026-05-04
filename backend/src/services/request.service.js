import prisma from '../lib/prisma.js';
import { MatchingService } from './matching.service.js';
import { getSocketIO } from '../socket/socket.js';

const matchingService = new MatchingService();

export class RequestService {
  async createRequest({ sessionId, userId, serviceType, description, userLatitude, userLongitude, userAddress }) {
    // Check if session already has a request
    if (sessionId) {
      const existing = await prisma.serviceRequest.findUnique({ where: { sessionId } });
      if (existing) return existing;
    }

    const request = await prisma.serviceRequest.create({
      data: {
        sessionId,
        userId,
        serviceType,
        description,
        status: 'SEARCHING',
        userLatitude,
        userLongitude,
        userAddress,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    return request;
  }

  async assignWorker(requestId, userLat, userLon, serviceType) {
    const worker = await matchingService.findBestWorker(serviceType, userLat, userLon);
    if (!worker) return null;

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { workerId: worker.id, status: 'ASSIGNED' },
      include: {
        worker: { include: { user: { select: { id: true, name: true, phone: true } } } },
        user: { select: { id: true, name: true } },
      },
    });

    // Notify worker via socket
    const io = getSocketIO();
    if (io) {
      io.to(`worker:${worker.userId}`).emit('request:assigned', {
        requestId: updated.id,
        serviceType: updated.serviceType,
        description: updated.description,
        userAddress: updated.userAddress,
        userLat,
        userLon,
      });
    }

    return { request: updated, worker };
  }

  async acceptRequest(requestId, workerId) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
      include: { user: true, worker: { include: { user: true } } },
    });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:accepted', {
        requestId: updated.id,
        workerName: updated.worker.user.name,
      });
    }

    return updated;
  }

  async rejectRequest(requestId, workerId) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', workerId: null },
    });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:rejected', { requestId: updated.id });
    }

    return updated;
  }

  async updateStatus(requestId, workerId, status) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(status === 'IN_PROGRESS' ? { startedAt: new Date() } : {}),
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:status', { requestId: updated.id, status });
    }

    return updated;
  }

  async setPrice(requestId, workerId, price) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (price <= 0) throw Object.assign(new Error('Invalid price'), { status: 400 });

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { proposedPrice: price, status: 'AWAITING_APPROVAL' },
      include: { worker: { include: { user: true } } },
    });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:price-set', {
        requestId: updated.id,
        price,
        workerName: updated.worker.user.name,
      });
    }

    return updated;
  }

  async getUserRequests(userId) {
    return prisma.serviceRequest.findMany({
      where: { userId },
      include: {
        worker: { include: { user: { select: { id: true, name: true, phone: true } } } },
        payment: true,
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkerRequests(workerId) {
    return prisma.serviceRequest.findMany({
      where: { workerId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        payment: true,
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequestById(id) {
    return prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true, address: true } },
        worker: { include: { user: { select: { id: true, name: true, phone: true } } } },
        payment: true,
        rating: true,
        session: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
      },
    });
  }

  async getAllRequests(filters = {}) {
    return prisma.serviceRequest.findMany({
      where: filters,
      include: {
        user: { select: { id: true, name: true } },
        worker: { include: { user: { select: { id: true, name: true } } } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
