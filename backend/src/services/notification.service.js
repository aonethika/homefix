import prisma from '../lib/prisma.js';
import { getSocketIO } from '../socket/socket.js';

export async function sendNotification(userId, title, message, type = 'INFO', data = {}) {
  const notification = await prisma.notification.create({
    data: { userId, title, message, type, data },
  });
  getSocketIO()?.to(`user:${userId}`).emit('notification:new', notification);
  return notification;
}

export async function notifyAdmins(title, message, type = 'INFO', data = {}) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  await Promise.all(admins.map(admin => sendNotification(admin.id, title, message, type, data)));
}
