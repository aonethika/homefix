import prisma from '../lib/prisma.js';
import { getSocketIO } from '../socket/socket.js';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

export class ChatLifecycleService {
  constructor(db = prisma) { this.db = db; }

  async stop({ userId, sessionId, requestId, expectedStatus, pendingOnly = true, actorRole, reason }) {
    const result = await this.db.$transaction(async tx => {
      const session = sessionId ? await tx.chatSession.findUnique({ where: { id: sessionId }, include: { request: true } }) : null;
      if (sessionId && !session) fail('Conversation not found', 404);
      if (session && session.userId !== userId) fail('Forbidden', 403);
      const request = requestId ? await tx.serviceRequest.findUnique({ where: { id: requestId } }) : session?.request;
      if (requestId && !request) fail('Request not found', 404);
      if (request && request.userId !== userId) {
        const professional = actorRole === 'WORKER' && request.workerId ? await tx.workerProfile.findUnique({ where: { id: request.workerId } }) : null;
        if (!professional || professional.userId !== userId) fail('Forbidden', 403);
      }
      if (request?.bookingStage) fail('Use the appointment cancellation controls for this booking.');
      const id = session?.id || request?.sessionId;
      if (request && request.status !== 'CANCELLED') {
        if (expectedStatus && expectedStatus !== request.status) fail('The professional responded before cancellation. Review the latest booking status.');
        const allowed = pendingOnly ? ['PENDING', 'SEARCHING', 'ASSIGNED'] : ['PENDING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED'];
        if (!allowed.includes(request.status)) fail('This request has changed and can no longer be stopped here.');
        const cancelled = await tx.serviceRequest.updateMany({ where: { id: request.id, status: request.status }, data: { status: 'CANCELLED', cancellationReason: `${actorRole === 'WORKER' ? 'Professional' : 'Homeowner'}: ${typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : 'Plans changed'}` } });
        if (cancelled.count !== 1) fail('This request changed before cancellation. Review the latest booking status.');
        if (request.status === 'ACCEPTED' && request.workerId && !request.scheduledAt) await tx.workerProfile.update({ where: { id: request.workerId }, data: { isAvailable: true } });
      }
      if (id) {
        const changed = await tx.chatSession.updateMany({ where: { id, userId: request?.userId || userId, state: { not: 'COMPLETED' } }, data: { state: 'COMPLETED' } });
        if (changed.count) await tx.chatMessage.create({ data: { sessionId: id, role: 'bot', content: request ? 'Request cancelled. No new search has started. Choose Find another professional when you are ready.' : 'Search stopped. Choose Find another professional when you are ready.', metadata: { kind: 'CANCELLED', requestId: request?.id } } });
      }
      return { sessionId: id, state: 'COMPLETED', request: request ? { ...request, status: 'CANCELLED' } : null };
    }, { isolationLevel: 'Serializable' });
    if (result.request) {
      const io = getSocketIO();
      const event = { requestId: result.request.id, status: 'CANCELLED' };
      io?.to(`user:${result.request.userId}`).emit('request:status', event);
      if (io && result.request.workerId) {
        const worker = await this.db.workerProfile.findUnique({ where: { id: result.request.workerId }, select: { userId: true } });
        if (worker) io?.to(`worker:${worker.userId}`).emit('request:status', event);
      }
      io?.to('workers').emit('request:claimed', event);
      io?.to('admins').emit('admin:request-updated', event);
    }
    return result;
  }
}
export const chatLifecycle = new ChatLifecycleService();
