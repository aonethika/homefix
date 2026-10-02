import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BookingService } from '../src/services/booking.service.js';
const owner = { id: 'home', role: 'USER' };
const worker = { id: 'pro', role: 'WORKER' };
function fixture(overrides = {}, conflict = null) {
  const row = { id: 'job', userId: 'home', workerId: 'worker', worker: { userId: 'pro' }, status: 'ASSIGNED', bookingStage: 'REQUESTED', expiresAt: new Date(Date.now() + 86400000), updatedAt: new Date(Date.now() - 3 * 86400000), ...overrides };
  const notifications = new Map();
  const tx = {
    serviceRequest: { findUnique: async () => row, findFirst: async () => conflict, findMany: async () => [{ id: row.id }], update: async ({ data }) => Object.assign(row, data) },
    workerProfile: { findUnique: async () => ({ applicationStatus: 'APPROVED' }) },
    notification: { create: async ({ data }) => notifications.set(String(notifications.size), data), upsert: async ({ where, create }) => { if (!notifications.has(where.dedupeKey)) notifications.set(where.dedupeKey, create); } },
  };
  return { row, notifications, service: new BookingService({ ...tx, $transaction: async fn => fn(tx) }) };
}
test('homeowner cannot reserve before acceptance or accept their own request', async () => {
  const { service, row } = fixture();
  await assert.rejects(service.change('job', owner, 'schedule', { scheduledAt: new Date(Date.now() + 86400000).toISOString() }), { status: 409 });
  await assert.rejects(service.change('job', owner, 'accept'), { status: 403 });
  assert.equal(row.bookingStage, 'REQUESTED');
});
test('outsiders cannot read through mutation endpoints or cancel a booking', async () => {
  for (const action of ['accept', 'schedule', 'cancel']) await assert.rejects(fixture().service.change('job', { id: 'other', role: 'USER' }, action), { status: 403 });
});
test('professional acceptance unlocks homeowner scheduling and persists both notifications', async () => {
  const { service, row, notifications } = fixture();
  await service.change('job', worker, 'accept');
  assert.equal(row.bookingStage, 'READY');
  assert.equal(row.scheduledAt, undefined);
  const scheduledAt = new Date(Date.now() + 86400000).toISOString();
  await service.change('job', owner, 'schedule', { scheduledAt });
  assert.equal(row.bookingStage, 'SCHEDULED');
  assert.equal(row.scheduledAt.toISOString(), scheduledAt);
  assert.equal(notifications.size, 4);
  await assert.rejects(service.change('job', owner, 'schedule', { scheduledAt }), { status: 409 });
});
test('conflicting appointment rejects schedule without changing accepted inquiry', async () => {
  const { service, row } = fixture({ bookingStage: 'READY', status: 'ACCEPTED' }, { id: 'reserved' });
  await assert.rejects(service.change('job', owner, 'schedule', { scheduledAt: new Date(Date.now() + 86400000).toISOString() }), { status: 409 });
  assert.equal(row.bookingStage, 'READY');
});
test('declined and cancelled requests cannot be scheduled; workers and admins can cancel', async () => {
  const declined = fixture(); await declined.service.change('job', worker, 'decline');
  assert.equal(declined.row.status, 'REJECTED');
  for (const actor of [owner, worker, { id: 'admin', role: 'ADMIN' }]) {
    const { service, row, notifications } = fixture({ bookingStage: 'SCHEDULED', status: 'ACCEPTED' });
    await service.change('job', actor, 'cancel', { reason: 'Unavailable' });
    assert.equal(row.status, 'CANCELLED'); assert.match(row.cancellationReason, /Unavailable/); assert.equal(notifications.size, 2);
    await assert.rejects(service.change('job', owner, 'schedule'), { status: 409 });
  }
});
test('expired unanswered requests close and notify once', async () => {
  const { service, row, notifications } = fixture({ expiresAt: new Date(Date.now() - 1000) });
  await service.tick(); await service.tick();
  assert.equal(row.bookingStage, 'EXPIRED'); assert.equal(row.status, 'CANCELLED'); assert.equal(notifications.size, 2);
});
test('day, hour and due reminders notify both people once and stop after cancellation', async () => {
  const now = Date.now();
  const { service, row, notifications } = fixture({ bookingStage: 'SCHEDULED', status: 'ACCEPTED', scheduledAt: new Date(now + 23 * 3600000), expiresAt: null });
  await service.tick(new Date(now)); await service.tick(new Date(now)); assert.equal(notifications.size, 2);
  await service.tick(new Date(now + 22.5 * 3600000)); await service.tick(new Date(now + 22.5 * 3600000)); assert.equal(notifications.size, 4);
  await service.tick(row.scheduledAt); await service.tick(row.scheduledAt); assert.equal(notifications.size, 6);
  await service.change('job', owner, 'cancel'); const size = notifications.size;
  await service.tick(row.scheduledAt); assert.equal(notifications.size, size);
});
test('work already started cannot be cancelled through appointment flow', async () => {
  await assert.rejects(fixture({ status: 'IN_PROGRESS', bookingStage: 'SCHEDULED' }).service.change('job', owner, 'cancel'), { status: 409 });
});

test('accepting a future request confirms the homeowner proposed time immediately', async () => {
  const scheduledAt = new Date(Date.now() + 86400000);
  const { service, row, notifications } = fixture({ scheduledAt });
  await service.change('job', worker, 'accept');
  assert.equal(row.bookingStage, 'SCHEDULED');
  assert.equal(row.status, 'ACCEPTED');
  assert.equal(row.scheduledAt, scheduledAt);
  assert.equal(row.expiresAt, null);
  assert.equal(notifications.size, 2);
});
test('professionals cannot accept overlapping future requests or a time that passed', async () => {
  const { service, row } = fixture({ scheduledAt: new Date(Date.now() + 86400000) }, { id: 'confirmed' });
  await assert.rejects(service.change('job', worker, 'accept'), { status: 409 });
  assert.equal(row.status, 'ASSIGNED');
  await assert.rejects(fixture({ scheduledAt: new Date(Date.now() - 1000) }).service.change('job', worker, 'accept'), { status: 409 });
});

test('homeowner rescheduling releases the old slot and requires acceptance again', async () => {
  const oldDate = new Date(Date.now() + 86400000);
  const { service, row, notifications } = fixture({ status: 'ACCEPTED', bookingStage: 'SCHEDULED', scheduledAt: oldDate, acceptedAt: new Date() });
  const scheduledAt = new Date(Date.now() + 2 * 86400000).toISOString();
  await service.change('job', owner, 'reschedule', { scheduledAt });
  assert.equal(row.status, 'ASSIGNED');
  assert.equal(row.bookingStage, 'REQUESTED');
  assert.equal(row.acceptedAt, null);
  assert.equal(row.scheduledAt.toISOString(), scheduledAt);
  assert.equal(notifications.size, 2);
  await service.tick(new Date(+oldDate - 1000));
  assert.equal(notifications.size, 2);
  await service.change('job', worker, 'accept');
  assert.equal(row.bookingStage, 'SCHEDULED');
});
test('time changes reject outsiders, professionals, started jobs and occupied slots', async () => {
  const data = { status: 'ACCEPTED', bookingStage: 'SCHEDULED', scheduledAt: new Date(Date.now() + 86400000) };
  const payload = { scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString() };
  for (const actor of [worker, { id: 'other', role: 'USER' }]) await assert.rejects(fixture(data).service.change('job', actor, 'reschedule', payload), { status: 403 });
  await assert.rejects(fixture({ ...data, status: 'IN_PROGRESS' }).service.change('job', owner, 'reschedule', payload), { status: 409 });
  const conflict = fixture(data, { id: 'other-job' });
  await assert.rejects(conflict.service.change('job', owner, 'reschedule', payload), { status: 409 });
  assert.equal(conflict.row.status, 'ACCEPTED');
  assert.equal(conflict.row.scheduledAt, data.scheduledAt);
});
