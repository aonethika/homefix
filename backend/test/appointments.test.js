import { test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { RequestService } from '../src/services/request.service.js';
import { appointmentDate } from '../src/services/booking.service.js';
import { WorkerService } from '../src/services/worker.service.js';

function mock(t, model, method, implementation) {
  const original = model[method];
  const stub = t.mock.fn(implementation);
  model[method] = stub;
  t.after(() => { model[method] = original; });
  return stub;
}

const input = () => ({ scheduledAt: new Date(Date.now() + 86400000).toISOString(), workerId: 'worker', serviceKey: 'PLUMBER', description: 'Fix leaking tap', userAddress: 'Customer address', safetyAcknowledged: true });
const worker = { id: 'worker', userId: 'professional', serviceKey: 'PLUMBER', services: [] };
function fixture(t, { conflict = null, profile = worker, outstanding = null } = {}) {
  const tx = {
    chatMessage: { create: t.mock.fn(async ({ data }) => data) },
    workerProfile: { findFirst: t.mock.fn(async () => profile) },
    serviceRequest: { findFirst: t.mock.fn(async ({ where }) => where.userId ? outstanding : conflict), create: t.mock.fn(async ({ data }) => ({ ...data, id: 'appointment', worker })) },
    chatSession: { update: t.mock.fn(async () => ({})), create: t.mock.fn(async () => ({ id: 'conversation' })) },
  };
  mock(t, prisma, '$transaction', async fn => fn(tx));
  mock(t, prisma.notification, 'create', async ({ data }) => data);
  return tx;
}
test('appointments reject invalid, past, too-soon and distant dates before writing', async () => {
  for (const scheduledAt of ['invalid', null, new Date().toISOString(), new Date(Date.now() + 181 * 86400_000).toISOString()]) {
    assert.throws(() => appointmentDate(scheduledAt), { status: 400 });
  }
});
test('appointment booking requires explicit homeowner safety acknowledgment', async t => {
  const tx = fixture(t);
  const payload = input(); delete payload.safetyAcknowledged;
  await assert.rejects(new RequestService().bookAppointment('customer', payload), { status: 400, message: /acknowledge the homeowner safety notice/ });
  assert.equal(tx.chatSession.create.mock.callCount(), 0);
});
test('homeowners cannot create another appointment while an earlier booking is unpaid', async t => {
  const tx = fixture(t, { outstanding: { id: 'unpaid', status: 'PAYMENT_PENDING', payment: { status: 'CREATED' } } });
  await assert.rejects(new RequestService().bookAppointment('customer', input()), { status: 409, message: /unfinished booking/ });
  assert.equal(tx.chatSession.create.mock.callCount(), 0);
  assert.equal(tx.serviceRequest.create.mock.callCount(), 0);
});
test('chat booking path also blocks a new request while an earlier booking is unpaid', async t => {
  mock(t, prisma, '$transaction', async fn => fn(prisma));
  mock(t, prisma.serviceRequest, 'findUnique', async () => null);
  mock(t, prisma.chatSession, 'updateMany', async () => ({ count: 1 }));
  const findOutstanding = mock(t, prisma.serviceRequest, 'findFirst', async () => ({ id: 'unpaid', status: 'PAYMENT_PENDING', payment: { status: 'CREATED' } }));
  const create = mock(t, prisma.serviceRequest, 'create', async () => { throw new Error('Must not create a second booking'); });
  await assert.rejects(new RequestService().createRequest({ sessionId: 'new-session', userId: 'customer', serviceType: 'PLUMBER', description: 'Fix tap' }), { status: 409, message: /unfinished booking/ });
  assert.equal(findOutstanding.mock.callCount(), 1);
  assert.equal(create.mock.callCount(), 0);
});
test('private or unapproved profiles cannot be booked through the directory', async t => {
  const tx = fixture(t, { profile: null });
  await assert.rejects(new RequestService().bookAppointment('customer', input()), { status: 404 });
  assert.deepEqual(tx.workerProfile.findFirst.mock.calls[0].arguments[0].where, { id: 'worker', isPublic: true, applicationStatus: 'APPROVED' });
  assert.equal(tx.serviceRequest.create.mock.callCount(), 0);
});
test('unsupported services cannot be booked', async t => {
  fixture(t);
  await assert.rejects(new RequestService().bookAppointment('customer', { ...input(), serviceKey: 'ELECTRICIAN' }), { status: 400 });
});
test('future request retains proposed time and awaits professional confirmation', async t => {
  const tx = fixture(t);
  const payload = input();
  const result = await new RequestService().bookAppointment('customer', payload);
  assert.equal(result.workerId, 'worker');
  assert.equal(result.userId, 'customer');
  assert.equal(result.sessionId, 'conversation');
  assert.equal(result.status, 'ASSIGNED');
  assert.equal(result.scheduledAt.toISOString(), payload.scheduledAt);
  assert.equal(result.bookingStage, 'REQUESTED');
  assert.ok(result.expiresAt > new Date());
  const sessionData = tx.chatSession.create.mock.calls[0].arguments[0].data;
  assert.equal(sessionData.context.safetyNoticeAccepted.version, 'home-service-safety-v1');
  assert.equal(sessionData.messages.create.metadata.acknowledged, true);

});
test('public directory enforces opt-in and omits exact location and identity documents', async t => {
  const find = mock(t, prisma.workerProfile, 'findMany', async () => []);
  await new WorkerService().getAllWorkers({ isPublic: false });
  const { where, select } = find.mock.calls[0].arguments[0];
  assert.equal(where.isPublic, true);
  assert.equal(where.applicationStatus, 'APPROVED');
  for (const key of ['latitude', 'longitude', 'address', 'panNumber', 'idDocument']) assert.equal(select[key], undefined);
});
test('profile editing rejects invalid visibility and overlong biography', async () => {
  for (const payload of [{ isPublic: 'true' }, { bio: 'x'.repeat(2001) }]) await assert.rejects(new WorkerService().updateProfile('professional', payload), { status: 400 });
});
test('a future appointment cannot be started early', async t => {
  mock(t, prisma.serviceRequest, 'findFirst', async () => ({ id: 'appointment', status: 'ACCEPTED', scheduledAt: new Date(Date.now() + 86400_000) }));
  await assert.rejects(new RequestService().updateStatus('appointment', 'worker', 'IN_PROGRESS'), { status: 409 });
});

test('customer request payloads exclude professional identity documents', () => {
  const select = new RequestService().requestInclude.worker.select;
  assert.equal(select.idDocument, undefined);
  assert.equal(select.panNumber, undefined);
  assert.equal(select.user.select.password, undefined);
});

test('future requests require a date and reject invalid attachments before creating records', async t => {
  const tx = fixture(t);
  await assert.rejects(new RequestService().bookAppointment('customer', { ...input(), scheduledAt: undefined }), { status: 400 });
  for (const attachments of [[{ mediaType: 'IMAGE', mediaData: 'data:text/html;base64,bad' }], [{ mediaType: 'AUDIO', mediaData: 'invalid' }], 'invalid']) {
    await assert.rejects(new RequestService().bookAppointment('customer', { ...input(), attachments }), { status: 400 });
  }
  assert.equal(tx.serviceRequest.create.mock.callCount(), 0);
});
test('future request stores photos and voice notes in the same conversation transaction', async t => {
  const tx = fixture(t);
  await new RequestService().bookAppointment('customer', { ...input(), attachments: [{ mediaType: 'IMAGE', mediaData: 'data:image/jpeg;base64,YWJj', fileName: 'tap.jpg' }, { mediaType: 'AUDIO', mediaData: 'data:audio/webm;codecs=opus;base64,YWJj', fileName: 'voice.webm' }] });
  assert.equal(tx.chatMessage.create.mock.callCount(), 3);
  assert.equal(tx.chatMessage.create.mock.calls[1].arguments[0].data.metadata.mediaType, 'IMAGE');
  assert.equal(tx.chatMessage.create.mock.calls[2].arguments[0].data.metadata.mediaType, 'AUDIO');
});
test('confirmed slot prevents sending an overlapping future booking request', async t => {
  const tx = fixture(t, { conflict: { id: 'booked' } });
  await assert.rejects(new RequestService().bookAppointment('customer', input()), { status: 409 });
  assert.equal(tx.serviceRequest.create.mock.callCount(), 0);
});
