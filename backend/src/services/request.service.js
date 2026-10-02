import { bookingService, appointmentDate } from './booking.service.js';
import prisma from '../lib/prisma.js';
import { MatchingService } from './matching.service.js';
import { getSocketIO } from '../socket/socket.js';
import { sendNotification, notifyAdmins } from './notification.service.js';

const matchingService = new MatchingService();
export const SAFETY_NOTICE_VERSION = 'home-service-safety-v1';
const OPEN_BOOKING_STATUSES = ['PENDING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PRICE_SET', 'AWAITING_APPROVAL', 'PAYMENT_PENDING', 'COMPLETED'];
const requireNoOutstandingBooking = async (db, userId) => {
  const outstanding = await db.serviceRequest.findFirst({
    where: { userId, status: { in: OPEN_BOOKING_STATUSES }, OR: [{ payment: null }, { payment: { is: { status: { not: 'PAID' } } } }] },
    select: { id: true, status: true, payment: { select: { status: true } } },
  });
  if (outstanding && outstanding.payment?.status !== 'PAID') {
    throw Object.assign(new Error('You already have an unfinished booking. Complete its payment or close it from My bookings before booking another service.'), { status: 409 });
  }
};
export const workerSelect = {
  id: true, userId: true, serviceType: true, serviceKey: true, bio: true,
  rating: true, totalJobs: true, isAvailable: true,
  user: { select: { id: true, name: true } },
};

export class RequestService {
  requestInclude = {
    user: { select: { id: true, name: true } },
    worker: { select: workerSelect },
    payment: true,
    rating: true,
    session: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
  };

  async bookAppointment(userId, payload) {
    const { workerId, serviceKey, description, userAddress, scheduledAt } = payload;
    if (payload.safetyAcknowledged !== true) throw Object.assign(new Error('Read and acknowledge the homeowner safety notice before booking.'), { status: 400 });
    const date = appointmentDate(scheduledAt);
    const attachments = payload.attachments || [];
    if (!Array.isArray(attachments) || attachments.length > 3 || attachments.some(a => !a || typeof a.mediaData !== 'string' || !(a.mediaType === 'IMAGE' ? /^data:image\/(jpeg|png|webp);base64,/i : a.mediaType === 'AUDIO' ? /^data:audio\/(webm|ogg|mp4|mpeg|wav|x-m4a)(?:;[^,]*)?;base64,/i : /$a/).test(a.mediaData)) || attachments.reduce((sum, a) => sum + a.mediaData.length, 0) > 8000000) throw Object.assign(new Error('Attach up to 3 photos or voice notes, under 6 MB in total.'), { status: 400 });
    if (typeof description !== 'string' || !description.trim() || description.length > 2000 || typeof userAddress !== 'string' || !userAddress.trim() || userAddress.length > 300 || typeof workerId !== 'string' || typeof serviceKey !== 'string') throw Object.assign(new Error('Choose a professional and service, and provide an issue and address'), { status: 400 });
    const request = await prisma.$transaction(async tx => {
      await requireNoOutstandingBooking(tx, userId);
      const worker = await tx.workerProfile.findFirst({ where: { id: workerId, isPublic: true, applicationStatus: 'APPROVED' }, include: { services: { include: { category: true } } } });
      if (!worker) throw Object.assign(new Error('This professional is not accepting public bookings'), { status: 404 });
      const keys = [worker.serviceKey, worker.serviceType, ...worker.services.filter(s => s.category.status === 'APPROVED').map(s => s.category.key)];
      if (!keys.includes(serviceKey)) throw Object.assign(new Error('Choose a service offered by this professional'), { status: 400 });
      const conflict = await tx.serviceRequest.findFirst({ where: { workerId, status: { in: ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'PAYMENT_PENDING'] }, scheduledAt: { gt: new Date(+date - 3600000), lt: new Date(+date + 3600000) } } });
      if (conflict) throw Object.assign(new Error('This time is already booked. Please choose another time.'), { status: 409 });
      const safetyNoticeAccepted = { version: SAFETY_NOTICE_VERSION, acceptedAt: new Date().toISOString() };
      const session = await tx.chatSession.create({ data: { userId, state: 'ASSIGNED', context: { serviceType: serviceKey, workerId, safetyNoticeAccepted }, messages: { create: { role: 'bot', content: 'zoon connects you with an independent professional. Agree on the scope and price in the app, never share OTPs, PINs or passwords, and report unsafe conduct. The professional is responsible for their conduct and work; this notice does not limit your rights under applicable law.', metadata: { kind: 'SAFETY_NOTICE', acknowledged: true, version: SAFETY_NOTICE_VERSION } } } } });
      const created = await tx.serviceRequest.create({ data: { userId, workerId, sessionId: session.id, serviceKey, serviceType: ['PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'].includes(serviceKey) ? serviceKey : null, description: description.trim(), userAddress: userAddress.trim(), scheduledAt: date, bookingStage: 'REQUESTED', expiresAt: new Date(Math.min(+date, Date.now() + 48 * 3600000)), status: 'ASSIGNED' }, include: this.requestInclude });
      await tx.chatSession.update({ where: { id: session.id }, data: { context: { serviceType: serviceKey, workerId, requestId: created.id, safetyNoticeAccepted } } });
      await tx.chatMessage.create({ data: { sessionId: session.id, role: 'user', content: description.trim(), metadata: { kind: 'CONVERSATION', senderId: userId } } });
      for (const attachment of attachments) await tx.chatMessage.create({ data: { sessionId: session.id, role: 'user', content: attachment.mediaType === 'IMAGE' ? 'Shared a photo of the issue' : 'Shared a voice note', metadata: { kind: 'CONVERSATION', senderId: userId, mediaType: attachment.mediaType, mediaData: attachment.mediaData, fileName: String(attachment.fileName || '').slice(0, 150) } } });
      return created;
    }, { isolationLevel: 'Serializable' });
    await sendNotification(request.worker.userId, 'New appointment request', 'A homeowner would like to discuss a job. Review the requested date, issue and attachments, then accept or decline.', 'JOB', { requestId: request.id, href: `/bookings/${request.id}` });
    getSocketIO()?.to(`worker:${request.worker.userId}`).emit('request:assigned', { requestId: request.id, href: `/bookings/${request.id}` });
    getSocketIO()?.to('admins').emit('admin:request-updated', { requestId: request.id });
    return request;
  }

  async getWorkerProfile(workerId) {
    return prisma.workerProfile.findUnique({
      where: { id: workerId },
      include: { user: { select: { id: true, name: true } }, services: { include: { category: true } } },
    });
  }

  workerCanSeeRequest(worker, request) {
    if (!worker || worker.applicationStatus !== 'APPROVED') return false;
    if (request.session?.context?.declinedWorkerIds?.includes(worker.id)) return false;
    if (request.session?.state === 'CHOOSE_WORKER') return false;
    if (!worker.isAvailable && request.workerId !== worker.id) return false;
    const requestKey = request.serviceKey || request.serviceType;
    const workerKeys = new Set([
      worker.serviceKey,
      worker.serviceType,
      ...(worker.services || []).filter(item => item.category?.status === 'APPROVED').map(item => item.category.key),
    ].filter(Boolean));
    if (!workerKeys.has(requestKey)) return false;
    const coordinates = [request.userLatitude, request.userLongitude, worker.latitude, worker.longitude];
    if (coordinates.every(value => value != null && Number.isFinite(Number(value)))) {
      const lat1 = Number(request.userLatitude) * Math.PI / 180;
      const lat2 = Number(worker.latitude) * Math.PI / 180;
      const deltaLat = (Number(worker.latitude) - Number(request.userLatitude)) * Math.PI / 180;
      const deltaLon = (Number(worker.longitude) - Number(request.userLongitude)) * Math.PI / 180;
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
      if (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) > 50) return false;
    }
    return true;
  }

  async createRequest({ sessionId, userId, serviceType, description, userLatitude, userLongitude, userAddress }) {
    const legacyType = ['PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'].includes(serviceType) ? serviceType : null;
    return prisma.$transaction(async tx => {
      if (sessionId) {
        const existing = await tx.serviceRequest.findUnique({ where: { sessionId } });
        if (existing) {
          if (existing.status !== 'PENDING' || existing.workerId) throw Object.assign(new Error('This conversation already belongs to a request. Start a new chat.'), { status: 409 });
          return existing;
        }
        const open = await tx.chatSession.updateMany({ where: { id: sessionId, userId, state: 'CHOOSE_WORKER' }, data: { updatedAt: new Date() } });
        if (open.count !== 1) throw Object.assign(new Error('This search has stopped. Start a new chat.'), { status: 409 });
      }
      await requireNoOutstandingBooking(tx, userId);
      return tx.serviceRequest.create({
        data: {
          sessionId,
          userId,
          serviceType: legacyType,
          serviceKey: serviceType,
          description,
          status: 'PENDING',
          userLatitude,
          userLongitude,
          userAddress,
        },
        include: { user: { select: { id: true, name: true } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async assignWorker(requestId, userLat, userLon, serviceType) {
    const worker = await matchingService.findBestWorker(serviceType, userLat, userLon);
    if (!worker) return null;

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId, status: { in: ['PENDING', 'SEARCHING'] } },
      data: { workerId: worker.id, status: 'ASSIGNED' },
      include: {
        worker: { select: workerSelect },
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
      io.to('admins').emit('admin:request-updated', { requestId: updated.id, status: updated.status });
    }
    await sendNotification(worker.userId, 'New service request', `${updated.user.name} needs help with ${serviceType.replaceAll('_', ' ').toLowerCase()}.`, 'JOB', { requestId: updated.id });
    await notifyAdmins('Request assigned', `A ${serviceType.replaceAll('_', ' ').toLowerCase()} request was assigned.`, 'JOB', { requestId: updated.id });

    return { request: updated, worker };
  }

  async assignSpecificWorker(requestId, workerId) {
    const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== 'PENDING') throw Object.assign(new Error('This request has already been sent'), { status: 409 });
    const worker = await prisma.workerProfile.findFirst({
      where: {
        id: workerId,
        isAvailable: true,
        applicationStatus: 'APPROVED',
        requests: { none: { OR: [{ bookingStage: null }, { bookingStage: { not: 'READY' } }], status: { in: ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'PAYMENT_PENDING'] } } },
      },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!worker) throw Object.assign(new Error('That professional is no longer available. Please choose another.'), { status: 409 });
    const updated = await prisma.serviceRequest.update({
      where: { id: requestId, status: request.status, workerId: null },
      data: { workerId, status: 'ASSIGNED' },
      include: { user: { select: { id: true, name: true } }, worker: { select: workerSelect } },
    });
    const io = getSocketIO();
    io?.to(`worker:${worker.userId}`).emit('request:assigned', {
      requestId: updated.id, serviceType: updated.serviceKey || updated.serviceType,
      description: updated.description, userAddress: updated.userAddress,
      userLat: updated.userLatitude, userLon: updated.userLongitude,
    });
    io?.to('admins').emit('admin:request-updated', { requestId: updated.id, status: 'ASSIGNED' });
    await sendNotification(worker.userId, 'You were selected for a job', `${updated.user.name} selected you for a ${(updated.serviceKey || updated.serviceType).replaceAll('_', ' ').toLowerCase()} request.`, 'JOB', { requestId: updated.id });
    return { request: updated, worker };
  }

  async broadcastRequest(request, candidates) {
    const workerIds = new Set((candidates || []).map(candidate => candidate.id));
    const workers = await prisma.workerProfile.findMany({
      where: { id: { in: [...workerIds] }, applicationStatus: 'APPROVED', isAvailable: true },
      include: { user: { select: { id: true, name: true } } },
    });
    const io = getSocketIO();
    for (const worker of workers) {
      io?.to(`worker:${worker.userId}`).emit('request:assigned', {
        requestId: request.id,
        serviceType: request.serviceKey || request.serviceType,
        description: request.description,
        userAddress: request.userAddress,
      });
      await sendNotification(worker.userId, 'New nearby service request', `A customer nearby needs ${(request.serviceKey || request.serviceType).replaceAll('_', ' ').toLowerCase()} help. Review the issue and accept if you can take it.`, 'JOB', { requestId: request.id });
    }
    io?.to('admins').emit('admin:request-updated', { requestId: request.id, status: 'SEARCHING' });
    return workers.length;
  }

  async acceptRequest(requestId, workerId) {
    const direct = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (direct?.bookingStage) { const worker = await this.getWorkerProfile(workerId); return bookingService.change(requestId, { id: worker?.userId, role: 'WORKER' }, 'accept'); }
    const [request, worker] = await Promise.all([
      prisma.serviceRequest.findUnique({ where: { id: requestId }, include: { session: true } }),
      this.getWorkerProfile(workerId),
    ]);
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    const isBroadcast = request.status === 'SEARCHING' && !request.workerId;
    const isDirectAssignment = request.status === 'ASSIGNED' && request.workerId === workerId;
    if (!worker || worker.applicationStatus !== 'APPROVED' || (!isBroadcast && !isDirectAssignment) || (isBroadcast && !this.workerCanSeeRequest(worker, request))) {
      throw Object.assign(new Error('Another professional accepted this request or it is no longer available'), { status: 409 });
    }

    const updated = await prisma.$transaction(async tx => {
      const busy = request.scheduledAt ? null : await tx.serviceRequest.findFirst({ where: { workerId, OR: [{ scheduledAt: null, bookingStage: null }, { scheduledAt: { lte: new Date(Date.now() + 3600_000) } }], id: { not: requestId }, status: { in: ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'PAYMENT_PENDING'] } } });
      if (busy) throw Object.assign(new Error('Finish your active job before accepting another'), { status: 409 });
      const claimed = await tx.serviceRequest.updateMany({
        where: isBroadcast
          ? { id: requestId, status: 'SEARCHING', workerId: null }
          : { id: requestId, status: 'ASSIGNED', workerId },
        data: { workerId, status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw Object.assign(new Error('Another professional already accepted this request'), { status: 409 });
      if (!request.scheduledAt) await tx.workerProfile.update({ where: { id: workerId }, data: { isAvailable: false } });
      if (request.sessionId) await tx.chatSession.update({ where: { id: request.sessionId }, data: { state: 'ASSIGNED' } });
      if (request.sessionId) await tx.chatMessage.create({ data: {
        sessionId: request.sessionId, role: 'bot',
        content: `${worker.user.name} accepted your request. You can message them here and follow their location when they share it.`,
        metadata: { requestId, kind: 'STATUS' },
      } });
      return tx.serviceRequest.findUnique({ where: { id: requestId }, include: this.requestInclude });
    }, { isolationLevel: 'Serializable' });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:accepted', {
        requestId: updated.id,
        workerName: updated.worker.user.name,
      });
      io.to('workers').emit('request:claimed', { requestId: updated.id, workerName: updated.worker.user.name });
      io.to('admins').emit('admin:request-updated', { requestId: updated.id, status: updated.status });
    }
    await sendNotification(updated.userId, 'Professional accepted', `${updated.worker.user.name} accepted your request.`, 'SUCCESS', { requestId: updated.id });

    return updated;
  }

  async rejectRequest(requestId, workerId) {
    const open = await prisma.serviceRequest.findUnique({ where: { id: requestId }, include: { session: true } });
    if (open?.bookingStage) { const worker = await this.getWorkerProfile(workerId); return bookingService.change(requestId, { id: worker?.userId, role: 'WORKER' }, 'decline'); }
    if (open?.status === 'SEARCHING' && !open.workerId) {
      const worker = await this.getWorkerProfile(workerId);
      if (!this.workerCanSeeRequest(worker, open) || !open.session) throw Object.assign(new Error('Request unavailable'), { status: 409 });
      await prisma.$transaction(async tx => {
        const session = await tx.chatSession.findUnique({ where: { id: open.sessionId } });
        const context = session.context || {};
        await tx.chatSession.update({ where: { id: session.id }, data: { context: { ...context, declinedWorkerIds: [...new Set([...(context.declinedWorkerIds || []), workerId])] } } });
      }, { isolationLevel: 'Serializable' });
      return open;
    }
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (request.status !== 'ASSIGNED') throw Object.assign(new Error('This request can no longer be rejected'), { status: 409 });

    const updated = await prisma.$transaction(async tx => {
      const changed = await tx.serviceRequest.updateMany({ where: { id: requestId, status: 'ASSIGNED', workerId }, data: { status: 'REJECTED' } });
      if (changed.count !== 1) throw Object.assign(new Error('This request has changed. Refresh before responding.'), { status: 409 });
      if (request.sessionId) {
        await tx.chatSession.update({ where: { id: request.sessionId }, data: { state: 'COMPLETED' } });
        await tx.chatMessage.create({ data: { sessionId: request.sessionId, role: 'bot', content: 'The professional declined this request. Choose Find another professional to start a new conversation.', metadata: { kind: 'STATUS', requestId } } });
      }
      return tx.serviceRequest.findUnique({ where: { id: requestId } });
    }, { isolationLevel: 'Serializable' });
    const io = getSocketIO();
    io?.to(`user:${updated.userId}`).emit('request:rejected', { requestId, message: 'The professional declined this request. Choose Find another professional to start again.', workers: [] });
    io?.to('admins').emit('admin:request-updated', { requestId, status: updated.status });

    return updated;
  }

  async updateStatus(requestId, workerId, status) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (status === 'IN_PROGRESS' && request.bookingStage && request.bookingStage !== 'SCHEDULED') throw Object.assign(new Error('Wait for the homeowner to reserve a date and time.'), { status: 409 });
    if (status === 'IN_PROGRESS' && request.scheduledAt && new Date(request.scheduledAt) > new Date()) throw Object.assign(new Error('This appointment has not started yet'), { status: 409 });
    const validTransition = (request.status === 'ACCEPTED' && status === 'IN_PROGRESS') ||
      (request.status === 'IN_PROGRESS' && status === 'COMPLETED');
    if (!validTransition) throw Object.assign(new Error(`Cannot change ${request.status} to ${status}`), { status: 409 });

    const updated = await prisma.$transaction(async tx => {
      if (status === 'IN_PROGRESS') {
        const active = await tx.serviceRequest.findFirst({ where: { workerId, id: { not: requestId }, status: 'IN_PROGRESS' } });
        if (active) throw Object.assign(new Error('Complete your current work before starting another job'), { status: 409 });
        await tx.workerProfile.update({ where: { id: workerId }, data: { isAvailable: false } });
      }
      return tx.serviceRequest.update({
        where: { id: requestId, status: request.status },
        data: { status, ...(status === 'IN_PROGRESS' ? { startedAt: new Date() } : { completedAt: new Date() }) },
      });
    }, { isolationLevel: 'Serializable' });

    if (request.sessionId) await prisma.chatMessage.create({ data: {
      sessionId: request.sessionId, role: 'bot',
      content: status === 'IN_PROGRESS' ? 'Your professional has started the work.' : 'Your professional marked the work complete. Review the final price when they send it.',
      metadata: { requestId, kind: 'STATUS' },
    } });

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:status', { requestId: updated.id, status });
      io.to('admins').emit('admin:request-updated', { requestId: updated.id, status });
    }
    await sendNotification(updated.userId, 'Service status updated', `Your service is now ${status.replaceAll('_', ' ').toLowerCase()}.`, 'INFO', { requestId: updated.id, status });

    return updated;
  }

  async setPrice(requestId, workerId, price) {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, worker: { id: workerId } },
    });
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (!['COMPLETED', 'AWAITING_APPROVAL'].includes(request.status)) throw Object.assign(new Error('Complete the work before setting a price'), { status: 409 });
    const normalizedPrice = Number(price);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || normalizedPrice > 1_000_000) throw Object.assign(new Error('Enter a valid price'), { status: 400 });

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { proposedPrice: normalizedPrice, counterPrice: null, status: 'AWAITING_APPROVAL' },
      include: { worker: { select: workerSelect } },
    });

    if (updated.sessionId) {
      const { ChatService } = await import('./chat.service.js');
      await new ChatService().handlePriceNotification(updated.sessionId, normalizedPrice, updated.worker.user.name);
    }

    const io = getSocketIO();
    if (io) {
      io.to(`user:${updated.userId}`).emit('request:price-set', {
        requestId: updated.id,
        price: normalizedPrice,
        workerName: updated.worker.user.name,
      });
      io.to('admins').emit('admin:request-updated', { requestId: updated.id, status: updated.status });
    }
    await sendNotification(updated.userId, 'Price ready', `${updated.worker.user.name} proposed ₹${normalizedPrice.toLocaleString('en-IN')}.`, 'INFO', { requestId: updated.id, price: normalizedPrice });

    return updated;
  }

  async getUserRequests(userId) {
    return prisma.serviceRequest.findMany({
      where: { userId },
      include: {
        worker: { select: workerSelect },
        payment: true,
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWorkerRequests(workerId) {
    const worker = await this.getWorkerProfile(workerId);
    if (!worker) return [];
    const requests = await prisma.serviceRequest.findMany({
      where: { OR: [{ workerId }, { workerId: null, status: 'SEARCHING' }] },
      include: this.requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return requests
      .filter(request => request.workerId === workerId || this.workerCanSeeRequest(worker, request))
      .map(request => ({ ...request, isOpenBroadcast: request.status === 'SEARCHING' && !request.workerId }));
  }

  async getRequestById(id) {
    return prisma.serviceRequest.findUnique({
      where: { id },
      include: this.requestInclude,
    });
  }

  async sendMessage(requestId, actor, payload) {
    const request = await prisma.serviceRequest.findUnique({ where: { id: requestId }, include: this.requestInclude });
    if (!request?.sessionId) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    let role = 'user';
    let worker = null;
    if (actor.role === 'WORKER') {
      worker = await this.getWorkerProfile(actor.workerProfile?.id);
      const authorized = request.workerId === worker?.id || (request.status === 'SEARCHING' && this.workerCanSeeRequest(worker, request));
      if (!authorized) throw Object.assign(new Error('This conversation is no longer available'), { status: 403 });
      role = 'worker';
    } else if (request.userId !== actor.id && actor.role !== 'ADMIN') {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    if (['CANCELLED', 'REJECTED', 'PAID'].includes(request.status)) throw Object.assign(new Error('This conversation is closed. You can send a new booking request.'), { status: 409 });
    const content = String(payload.content || '').trim().slice(0, 2000);
    const mediaType = ['IMAGE', 'AUDIO'].includes(payload.mediaType) ? payload.mediaType : null;
    const mediaData = typeof payload.mediaData === 'string' ? payload.mediaData : null;
    const allowedMedia = mediaType === 'IMAGE'
      ? /^data:image\/(jpeg|png|webp);base64,/i
      : /^data:audio\/(webm|ogg|mp4|mpeg|wav|x-m4a)(?:;[^,]*)?;base64,/i;
    if (!content && !mediaData) throw Object.assign(new Error('Write a message or attach media'), { status: 400 });
    if (mediaData && (!mediaType || !allowedMedia.test(mediaData) || mediaData.length > 9_000_000)) {
      throw Object.assign(new Error('Use a supported image or voice note under 6 MB'), { status: 400 });
    }
    const message = await prisma.chatMessage.create({
      data: {
        sessionId: request.sessionId,
        role,
        content: content || (mediaType === 'IMAGE' ? 'Shared an image' : 'Shared a voice note'),
        metadata: { kind: 'CONVERSATION', senderId: actor.id, senderName: actor.name, mediaType, mediaData, fileName: payload.fileName || null },
      },
    });
    const io = getSocketIO();
    io?.to(`user:${request.userId}`).emit('request:message', { requestId, message });
    if (request.worker?.userId) {
      io?.to(`worker:${request.worker.userId}`).emit('request:message', { requestId, message });
      if (actor.id !== request.worker.userId) await sendNotification(request.worker.userId, 'New customer message', content || `The customer shared ${mediaType === 'IMAGE' ? 'an image' : 'a voice note'}.`, 'INFO', { requestId });
    } else {
      const nearby = await matchingService.getNearbyWorkers(request.serviceKey || request.serviceType, request.userLatitude, request.userLongitude, 50);
      for (const nearbyWorker of nearby) {
        io?.to(`worker:${nearbyWorker.userId}`).emit('request:message', { requestId, message });
      }
    }
    if (role === 'worker') await sendNotification(request.userId, 'Message from a professional', content || `A professional shared ${mediaType === 'IMAGE' ? 'an image' : 'a voice note'}.`, 'INFO', { requestId });
    return message;
  }

  async getAllRequests(filters = {}) {
    return prisma.serviceRequest.findMany({
      where: filters,
      include: {
        user: { select: { id: true, name: true } },
        worker: { select: workerSelect },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
