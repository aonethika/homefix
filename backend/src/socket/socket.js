import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.userId}`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Worker room (if worker)
    socket.on('join:worker', () => {
      socket.join(`worker:${socket.userId}`);
      logger.info(`Worker ${socket.userId} joined worker room`);
    });

    // Worker location update
    socket.on('worker:location', (data) => {
      io.emit('worker:location:update', { workerId: socket.userId, ...data });
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
