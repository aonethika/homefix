import { test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { ChatService } from '../src/services/chat.service.js';
import { RequestService } from '../src/services/request.service.js';
import { MatchingService } from '../src/services/matching.service.js';

function mockPrisma(t, model, method, implementation) {
  const original = model[method];
  const stub = t.mock.fn(implementation);
  model[method] = stub;
  t.after(() => { model[method] = original; });
  return stub;
}

function chatFixture(t, state, context = {}, request = null) {
  const session = { id: 'session', userId: 'customer', state, context, request };
  const messages = [];
  mockPrisma(t, prisma.chatSession, 'findUnique', async () => session);
  mockPrisma(t, prisma.chatSession, 'update', async ({ data }) => Object.assign(session, data));
  mockPrisma(t, prisma.chatMessage, 'create', async ({ data }) => { messages.push(data); return data; });
  mockPrisma(t, prisma.serviceCategory, 'findMany', async () => []);
  return { session, messages, chat: new ChatService({ understand: async () => ({ serviceType: null, urgency: 'normal', intent: 'other' }) }) };
}

test('customer selection sends a request only to the chosen candidate', async t => {
  const { chat, messages, session } = chatFixture(t, 'CHOOSE_WORKER', {
    serviceType: 'AC_TECHNICIAN', description: 'AC not cooling', candidates: [{ id: 'worker-a', name: 'Babu' }, { id: 'worker-b', name: 'Other' }],
  });
  t.mock.method(RequestService.prototype, 'createRequest', async () => ({ id: 'request' }));
  const assign = t.mock.method(RequestService.prototype, 'assignSpecificWorker', async () => ({}));
  const broadcast = t.mock.method(RequestService.prototype, 'broadcastRequest', async () => { throw new Error('Must not broadcast'); });
  const result = await chat.processMessage('session', 'customer', 'SELECT_WORKER:worker-a', { safetyAcknowledged: true });
  assert.deepEqual(assign.mock.calls[0].arguments, ['request', 'worker-a']);
  assert.equal(broadcast.mock.callCount(), 0);
  assert.equal(result.metadata.requestStatus, 'ASSIGNED');
  assert.equal(messages[0].content, 'Request Babu');
  assert.equal(session.context.safetyNoticeAccepted.version, 'home-service-safety-v1');
});

test('chat does not send a professional request until the safety notice is acknowledged', async t => {
  const { chat, messages } = chatFixture(t, 'CHOOSE_WORKER', { candidates: [{ id: 'worker-a', name: 'Babu' }] });
  await assert.rejects(chat.processMessage('session', 'customer', 'SELECT_WORKER:worker-a'), { status: 400, message: /safety notice/ });
  assert.equal(messages.length, 0);
});

test('unknown selections and generic confirmation cannot silently broadcast a request', async t => {
  const { chat } = chatFixture(t, 'CHOOSE_WORKER', { candidates: [{ id: 'allowed', name: 'Babu' }] });
  const create = t.mock.method(RequestService.prototype, 'createRequest', async () => { throw new Error('Must not create'); });
  for (const input of ['SELECT_WORKER:unknown', 'Yes, share my issue']) {
    const result = await chat.processMessage('session', 'customer', input);
    assert.equal(result.metadata.action, 'CHOOSE_WORKER');
  }
  assert.equal(create.mock.callCount(), 0);
});

test('price approval transitions to payment using the current request price', async t => {
  const { chat, session } = chatFixture(t, 'AWAITING_PRICE', { requestId: 'request', proposedPrice: 100 }, { id: 'request', proposedPrice: 500, status: 'AWAITING_APPROVAL' });
  const update = mockPrisma(t, prisma.serviceRequest, 'update', async ({ data }) => Object.assign(session.request, data));
  const result = await chat.processMessage('session', 'customer', 'Yes, I approve the price');
  assert.equal(result.state, 'PAYMENT_PENDING');
  assert.deepEqual(result.metadata, { action: 'INITIATE_PAYMENT', requestId: 'request', amount: 500 });
  assert.equal(update.mock.calls[0].arguments[0].data.finalPrice, 500);
  const repeated = await chat.processMessage('session', 'customer', 'Yes, I approve the price');
  assert.equal(repeated.metadata.action, 'SHOW_PAYMENT');
  assert.equal(repeated.metadata.amount, 500);
  assert.equal(update.mock.callCount(), 1);
});

test('plain addresses are not searched as zero coordinates; retry uses the saved map pin', async t => {
  const { chat } = chatFixture(t, 'NEED_LOCATION', { serviceType: 'AC_TECHNICIAN', userLat: 11.17, userLon: 75.87, userAddress: 'Ramanattukara' });
  const nearby = t.mock.method(MatchingService.prototype, 'getNearbyWorkers', async () => []);
  const missing = await chat.processMessage('session', 'customer', 'Ramanattukara');
  assert.equal(missing.metadata.action, 'REQUEST_LOCATION');
  assert.equal(nearby.mock.callCount(), 0);
  const retry = await chat.processMessage('session', 'customer', 'Search again');
  assert.equal(retry.metadata.action, 'RETRY_SEARCH');
  assert.deepEqual(nearby.mock.calls[0].arguments, ['AC_TECHNICIAN', 11.17, 75.87, 50]);
  assert.doesNotMatch(retry.reply, /notify you/);
});

test('a declined legacy request and customer choice in progress are hidden from other workers', () => {
  const service = new RequestService();
  const worker = { id: 'worker', applicationStatus: 'APPROVED', isAvailable: true, serviceKey: 'AC_TECHNICIAN' };
  const request = { serviceKey: 'AC_TECHNICIAN', session: { context: { declinedWorkerIds: ['worker'] } } };
  assert.equal(service.workerCanSeeRequest(worker, request), false);
  assert.equal(service.workerCanSeeRequest(worker, { ...request, session: { state: 'CHOOSE_WORKER' } }), false);
  assert.equal(service.workerCanSeeRequest(worker, { ...request, session: null }), true);
});

test('already assigned requests cannot be reassigned by replaying a selection', async t => {
  mockPrisma(t, prisma.serviceRequest, 'findUnique', async () => ({ id: 'request', status: 'ACCEPTED', workerId: 'original' }));
  await assert.rejects(new RequestService().assignSpecificWorker('request', 'other'), { status: 409 });
});

test('declining a direct request closes its conversation without reassigning another professional', async t => {
  const request = { id: 'request', sessionId: 'session', workerId: 'worker-a', userId: 'customer', status: 'ASSIGNED' };
  mockPrisma(t, prisma.serviceRequest, 'findUnique', async () => request);
  mockPrisma(t, prisma.serviceRequest, 'findFirst', async () => request);
  const sessionUpdate = mockPrisma(t, prisma.chatSession, 'update', async args => args);
  mockPrisma(t, prisma.chatMessage, 'create', async args => args);
  mockPrisma(t, prisma.serviceRequest, 'updateMany', async ({ where, data }) => { assert.equal(where.status, 'ASSIGNED'); Object.assign(request, data); return { count: 1 }; });
  mockPrisma(t, prisma, '$transaction', async fn => fn(prisma));
  const result = await new RequestService().rejectRequest('request', 'worker-a');
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.workerId, 'worker-a');
  assert.equal(sessionUpdate.mock.calls[0].arguments[0].data.state, 'COMPLETED');
});
