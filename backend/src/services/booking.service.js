import prisma from '../lib/prisma.js';
import { getSocketIO } from '../socket/socket.js';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const include = { worker: { select: { id: true, userId: true, user: { select: { name: true } } } } };
const closed = ['CANCELLED', 'REJECTED', 'COMPLETED', 'PAID'];
export function appointmentDate(value, now = Date.now()) {
  const date = new Date(value);
  if (typeof value !== 'string' || !Number.isFinite(+date) || +date < now + 900000 || +date > now + 180 * 86400000) fail('Choose a time at least 15 minutes ahead and within 180 days.', 400);
  return date;
}
export class BookingService {
  constructor(db = prisma) { this.db = db; }
  async notice(tx, request, title, message, key) {
    for (const userId of new Set([request.userId, request.worker?.userId].filter(Boolean))) {
      const data = { userId, title, message, type: 'APPOINTMENT', data: { requestId: request.id, href: `/bookings/${request.id}`, scheduledAt: request.scheduledAt?.toISOString() || null } };
      if (key) await tx.notification.upsert({ where: { dedupeKey: `${request.id}:${userId}:${key}` }, create: { ...data, dedupeKey: `${request.id}:${userId}:${key}` }, update: {} });
      else await tx.notification.create({ data });
    }
  }
  async change(id, actor, action, payload = {}) {
    const result = await this.db.$transaction(async tx => {
      const r = await tx.serviceRequest.findUnique({ where: { id }, include });
      if (!r?.bookingStage) fail('This appointment could not be found.', 404);
      const owner = r.userId === actor.id;
      const worker = r.worker?.userId === actor.id && actor.role === 'WORKER';
      if (!owner && !worker && actor.role !== 'ADMIN') fail('You cannot open this appointment.', 403);
      if (payload.expectedStatus && payload.expectedStatus !== r.status) fail('This booking changed before cancellation. Review its latest status.');
      if (closed.includes(r.status)) fail('This appointment is already closed. You can make a new request.');
      if (r.expiresAt && r.expiresAt <= new Date() && action !== 'cancel') fail('This request has expired. Please make a new request.');
      let data, message;
      if (action === 'accept' || action === 'decline') {
        if (!worker) fail('Only the selected professional can respond.', 403);
        const profile = await tx.workerProfile.findUnique({ where: { id: r.workerId } });
        if (profile?.applicationStatus !== 'APPROVED') fail('Your professional account needs approval before responding.', 403);
        if (r.bookingStage !== 'REQUESTED' || r.status !== 'ASSIGNED') fail('This request has already been answered.');
        if (action === 'accept' && r.scheduledAt) {
          if (+r.scheduledAt <= Date.now()) fail('The requested time has passed. Ask the homeowner to send a new request.');
          const conflict = await tx.serviceRequest.findFirst({ where: { id: { not: id }, workerId: r.workerId, status: { in: ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'PAYMENT_PENDING'] }, scheduledAt: { gt: new Date(+r.scheduledAt - 3600000), lt: new Date(+r.scheduledAt + 3600000) } } });
          if (conflict) fail('You already have a booking at this time. Decline this request or arrange another time with the homeowner.');
        }
        data = action === 'accept' ? { bookingStage: r.scheduledAt ? 'SCHEDULED' : 'READY', status: 'ACCEPTED', acceptedAt: new Date(), expiresAt: r.scheduledAt ? null : new Date(Date.now() + 7 * 86400000) } : { bookingStage: 'DECLINED', status: 'REJECTED', expiresAt: null };
        message = action === 'accept' ? r.scheduledAt ? 'The professional accepted your requested date and time. Your appointment is confirmed.' : 'The professional accepted. Choose a date and time for this earlier request.' : 'The professional cannot take this request. You can choose another professional.';
      } else if (action === 'reschedule') {
        if (!owner || actor.role !== 'USER') fail('Only the homeowner can request a different time.', 403);
        if (!['ASSIGNED', 'ACCEPTED'].includes(r.status) || !r.scheduledAt) fail('This booking can no longer be rescheduled.');
        const date = appointmentDate(payload.scheduledAt);
        if (+date === +r.scheduledAt) fail('Choose a different date or time.', 400);
        const conflict = await tx.serviceRequest.findFirst({ where: { id: { not: id }, workerId: r.workerId, status: { in: ['ACCEPTED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'PAYMENT_PENDING'] }, scheduledAt: { gt: new Date(+date - 3600000), lt: new Date(+date + 3600000) } } });
        if (conflict) fail('This time is already booked. Please choose another time.');
        data = { scheduledAt: date, status: 'ASSIGNED', bookingStage: 'REQUESTED', acceptedAt: null, expiresAt: new Date(Math.min(+date, Date.now() + 48 * 3600000)) };
        message = 'The homeowner requested a different date and time. The previous slot has been released. The professional must accept the new time before it is confirmed.';
      } else if (action === 'schedule') {
        if (!owner || actor.role !== 'USER') fail('Only the homeowner can reserve a time.', 403);
        if (r.bookingStage !== 'READY' || r.status !== 'ACCEPTED') fail('Wait for the professional to accept before choosing a time.');
        const date = appointmentDate(payload.scheduledAt);
        const conflict = await tx.serviceRequest.findFirst({ where: { id: { not: id }, workerId: r.workerId, status: { notIn: closed }, scheduledAt: { gt: new Date(+date - 3600000), lt: new Date(+date + 3600000) } } });
        if (conflict) fail('That time is reserved. Please choose a time at least one hour apart.');
        data = { scheduledAt: date, bookingStage: 'SCHEDULED', expiresAt: null };
        message = 'Your appointment is reserved. Open the appointment to see the time in your timezone. Zoon will remind both of you before it starts.';
      } else if (action === 'cancel') {
        if (!['ASSIGNED', 'ACCEPTED'].includes(r.status)) fail('Work has already started. Please contact support to resolve this booking.');
        const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 500) : '';
        data = { bookingStage: 'CANCELLED', status: 'CANCELLED', expiresAt: null, cancellationReason: `${actor.role === 'ADMIN' ? 'Admin' : worker ? 'Professional' : 'Homeowner'}: ${reason || 'Plans changed'}` };
        message = `Appointment cancelled. ${data.cancellationReason}. You can make a new request when ready.`;
      } else fail('Please choose a valid action.', 400);
      const updated = await tx.serviceRequest.update({ where: { id, status: r.status, bookingStage: r.bookingStage }, data, include });
      if (r.sessionId) {
        await tx.chatMessage.create({ data: { sessionId: r.sessionId, role: 'bot', content: message, ...(action === 'reschedule' ? { metadata: { kind: 'RESCHEDULE', previousScheduledAt: r.scheduledAt.toISOString(), scheduledAt: updated.scheduledAt.toISOString() } } : {}) } });
        if (['cancel', 'decline'].includes(action)) await tx.chatSession.update({ where: { id: r.sessionId }, data: { state: 'COMPLETED' } });
      }
      await this.notice(tx, updated, action === 'schedule' ? 'Appointment reserved' : 'Appointment update', message);
      return updated;
    }, { isolationLevel: 'Serializable' });
    const io = getSocketIO();
    io?.to(`user:${result.userId}`).emit('request:status', { requestId: id, status: result.status });
    io?.to(`worker:${result.worker.userId}`).emit('request:status', { requestId: id, status: result.status });
    io?.to('admins').emit('admin:request-updated', { requestId: id });
    return result;
  }
  async tick(now = new Date()) {
    const pending = await this.db.serviceRequest.findMany({ where: { OR: [{ bookingStage: { in: ['REQUESTED', 'READY'] }, expiresAt: { lte: now } }, { bookingStage: 'SCHEDULED', status: 'ACCEPTED', scheduledAt: { lte: new Date(+now + 86400000) } }] }, select: { id: true } });
    for (const { id } of pending) {
      try {
        await this.db.$transaction(async tx => {
          const r = await tx.serviceRequest.findUnique({ where: { id }, include });
          if (!r || closed.includes(r.status)) return;
          if (['REQUESTED', 'READY'].includes(r.bookingStage) && r.expiresAt && r.expiresAt <= now) {
            await tx.serviceRequest.update({ where: { id, status: r.status, bookingStage: r.bookingStage }, data: { status: 'CANCELLED', bookingStage: 'EXPIRED', expiresAt: null, cancellationReason: 'The response or scheduling deadline passed.' } });
            if (r.sessionId) {
              await tx.chatSession.update({ where: { id: r.sessionId }, data: { state: 'COMPLETED' } });
              await tx.chatMessage.create({ data: { sessionId: r.sessionId, role: 'bot', content: 'This request expired. You can contact another professional or send a new request.' } });
            }
            await this.notice(tx, r, 'Request expired', 'The response or scheduling deadline passed. You can make a new request.', 'expired');
          } else if (r.bookingStage === 'SCHEDULED' && r.status === 'ACCEPTED') {
            const remaining = +r.scheduledAt - +now;
            if (remaining < -3600000) return;
            const key = remaining <= 0 ? 'due' : remaining <= 3600000 ? 'hour' : 'day';
            // Do not send a day-ahead reminder for a booking just made less than a day ahead.
            if (remaining > 0 && +r.updatedAt > +r.scheduledAt - (key === 'day' ? 86400000 : 3600000)) return;
            await this.notice(tx, r, 'Appointment reminder', remaining <= 0 ? 'Your appointment is due now. Open it to message each other or manage changes.' : `Your appointment starts within ${key === 'hour' ? 'one hour' : '24 hours'}. Open it to check the time and address.`, `${key}:${r.scheduledAt.toISOString()}`);
          }
        }, { isolationLevel: 'Serializable' });
      } catch (error) { if (!['P2002', 'P2025', 'P2034'].includes(error.code)) throw error; }
    }
  }
}
export const bookingService = new BookingService();
let running = false;
export async function runAppointmentReminders() {
  if (running) return;
  running = true;
  try { await bookingService.tick(); } finally { running = false; }
}
