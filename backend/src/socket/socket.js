import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { corsOptions } from '../utils/cors.js';
import prisma from '../lib/prisma.js';

let io = null;
const requestLocations = new Map();
export function getRequestLocation(requestId) {
  const location = requestLocations.get(requestId);
  if (!location || Date.now() - new Date(location.updatedAt).getTime() > 300000) { requestLocations.delete(requestId); return null; }
  return location;
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: corsOptions,
  });

  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, role: true } })
        .then(user => {
          if (!user) return next(new Error('Invalid token'));
          socket.userId = user.id;
          socket.userRole = user.role;
          next();
        })
        .catch(() => next(new Error('Authentication failed')));
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.userId}`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    if (socket.userRole === 'ADMIN') socket.join('admins');

    // Worker room (if worker)
    socket.on('join:worker', () => {
      if (socket.userRole !== 'WORKER') return;
      socket.join(`worker:${socket.userId}`);
      socket.join('workers');
      logger.info(`Worker ${socket.userId} joined worker room`);
    });

    // Worker location update
    socket.on('worker:location', async (data) => {
      if (socket.userRole !== 'WORKER') return;
      if (data?.lat == null || data?.lon == null) return;
      try {
      const latitude = Number(data?.lat);
      const longitude = Number(data?.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
      const worker = await prisma.workerProfile.update({ where: { userId: socket.userId }, data: { latitude, longitude } });
      const activeRequests = await prisma.serviceRequest.findMany({ where: { workerId: worker.id, OR: [{ scheduledAt: null, bookingStage: null }, { scheduledAt: { lte: new Date(Date.now() + 3600000) }, bookingStage: { not: 'READY' } }], status: { in: ['ACCEPTED', 'IN_PROGRESS'] } }, select: { id: true, userId: true } });
      for (const [id, sample] of requestLocations) if (Date.now() - new Date(sample.updatedAt).getTime() > 300000) requestLocations.delete(id);
      for (const request of activeRequests) {
        const sample = { workerId: worker.id, requestId: request.id, lat: latitude, lon: longitude, updatedAt: new Date().toISOString(), accuracy: Number.isFinite(data.accuracy) ? data.accuracy : null };
        requestLocations.set(request.id, sample);
        io.to(`user:${request.userId}`).emit('worker:location:update', sample);
      }
      } catch (error) { logger.warn(`Location update failed: ${error.message}`); }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io initialized');
  return io;
}

export function getSocketIO() {
  return io;
}
