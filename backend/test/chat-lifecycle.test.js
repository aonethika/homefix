import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatLifecycleService } from '../src/services/chat-lifecycle.service.js';
import { ChatService } from '../src/services/chat.service.js';
import { RequestService } from '../src/services/request.service.js';
import prisma from '../src/lib/prisma.js';

function fixture({ status = 'ASSIGNED', request = true, race = false } = {}) {
  const row = request ? { id: 'request', userId: 'owner', workerId: status === 'SEARCHING' ? null : 'worker', sessionId: 'chat', status } : null;
  const session = { id: 'chat', userId: 'owner', state: request ? 'ASSIGNED' : 'NEED_LOCATION', request: row };
  const messages = [];
  const db = {
    chatSession: { findUnique: async () => session, updateMany: async ({ where, data }) => { if (session.state === 'COMPLETED') return { count: 0 }; Object.assign(session, data); return { count: 1 }; } },
    serviceRequest: { findUnique: async () => row, updateMany: async ({ where, data }) => {
      if (race) row.status = 'ACCEPTED';
      if (row.status !== where.status) return { count: 0 };
      Object.assign(row, data); return { count: 1 };
    } },
    chatMessage: { create: async ({ data }) => { messages.push(data); return data; } },
    workerProfile: { update: async () => { throw new Error('Pending cancellation must not change worker availability'); } },
  };
  db.$transaction = async fn => fn(db);
  return { service: new ChatLifecycleService(db), row, session, messages };
}

for (const status of ['PENDING', 'SEARCHING', 'ASSIGNED']) test(`stopping ${status} closes request and session atomically and is idempotent`, async () => {
  const { service, row, session, messages } = fixture({ status });
  await service.stop({ userId: 'owner', sessionId: 'chat', expectedStatus: status });
  assert.equal(row.status, 'CANCELLED'); assert.equal(session.state, 'COMPLETED'); assert.equal(messages.length, 1);
  await service.stop({ userId: 'owner', sessionId: 'chat', expectedStatus: status });
  assert.equal(messages.length, 1);
});
test('an in-flight location search can be stopped before a request exists', async () => {
  const { service, session } = fixture({ request: false });
  const result = await service.stop({ userId: 'owner', sessionId: 'chat' });
  assert.equal(session.state, 'COMPLETED'); assert.equal(result.request, null);
});
test('a different customer cannot stop a search or cancel a request', async () => {
  for (const args of [{ sessionId: 'chat' }, { requestId: 'request' }]) {
    const { service, row } = fixture();
    await assert.rejects(service.stop({ userId: 'outsider', ...args }), { status: 403 });
    assert.equal(row.status, 'ASSIGNED');
  }
});
test('acceptance before pending cancellation is authoritative', async () => {
  const { service, row, session } = fixture({ status: 'ACCEPTED' });
  await assert.rejects(service.stop({ userId: 'owner', sessionId: 'chat', expectedStatus: 'ASSIGNED' }), { status: 409 });
  assert.equal(row.status, 'ACCEPTED'); assert.equal(session.state, 'ASSIGNED');
});
test('acceptance between read and cancel compare-and-set cannot be overwritten', async () => {
  const { service, row, session } = fixture({ race: true });
  await assert.rejects(service.stop({ userId: 'owner', sessionId: 'chat', expectedStatus: 'ASSIGNED' }), { status: 409 });
  assert.equal(row.status, 'ACCEPTED'); assert.equal(session.state, 'ASSIGNED');
});
test('started work cannot be cancelled using the pending search shortcut', async () => {
  const { service } = fixture({ status: 'IN_PROGRESS' });
  await assert.rejects(service.stop({ userId: 'owner', requestId: 'request' }), { status: 409 });
});
function mock(t, model, method, implementation) {
  const original = model[method]; model[method] = t.mock.fn(implementation);
  t.after(() => { model[method] = original; }); return model[method];
}
test('a delayed search cannot reopen a completed session', async t => {
  mock(t, prisma.chatSession, 'update', async ({ where }) => {
    assert.deepEqual(where.state, { not: 'COMPLETED' });
    throw Object.assign(new Error('No open row'), { code: 'P2025' });
  });
  await assert.rejects(new ChatService().updateOpenSession({ where: { id: 'chat' }, data: { state: 'CHOOSE_WORKER' } }), { status: 409 });
});
test('cancelled requests cannot be accepted or assigned again', async t => {
  mock(t, prisma.serviceRequest, 'findUnique', async () => ({ id: 'request', status: 'CANCELLED', workerId: 'worker' }));
  t.mock.method(RequestService.prototype, 'getWorkerProfile', async () => ({ id: 'worker', applicationStatus: 'APPROVED' }));
  const service = new RequestService();
  await assert.rejects(service.acceptRequest('request', 'worker'), { status: 409 });
  await assert.rejects(service.assignSpecificWorker('request', 'worker'), { status: 409 });
});
test('create session reuses only an empty unassigned conversation', async t => {
  mock(t, prisma, '$transaction', async fn => fn(prisma));
  mock(t, prisma.chatSession, 'findFirst', async ({ where }) => {
    assert.equal(where.state, 'INIT'); assert.equal(where.request, null); assert.deepEqual(where.messages, { none: {} });
    return { id: 'empty' };
  });
  const create = mock(t, prisma.chatSession, 'create', async () => { throw new Error('Must reuse empty draft'); });
  const chat = new ChatService();
  assert.equal((await chat.createSession('owner')).id, 'empty');
  assert.equal((await chat.createSession('owner')).id, 'empty');
  assert.equal(create.mock.callCount(), 0);
});
test('restart creates a separate session without the old request or professional', async t => {
  mock(t, prisma, '$transaction', async fn => fn(prisma));
  const old = { id: 'old', userId: 'owner', state: 'COMPLETED', request: { id: 'cancelled', workerId: 'previous', status: 'CANCELLED' }, context: { serviceType: 'PLUMBER', description: 'Leaking pipe', userLat: 10, userLon: 76 } };
  mock(t, prisma.chatSession, 'findUnique', async () => old);
  mock(t, prisma.serviceRequest, 'findFirst', async () => null);
  mock(t, prisma.chatSession, 'create', async ({ data }) => ({ id: 'fresh', ...data }));
  const result = await new ChatService().restartSession('old', 'owner');
  assert.equal(result.id, 'fresh'); assert.equal(result.context.requestId, undefined); assert.equal(result.context.excludedWorkerId, 'previous');
  assert.equal(old.request.id, 'cancelled');
});
test('restart refuses to create a new search while another booking remains open', async t => {
  mock(t, prisma, '$transaction', async fn => fn(prisma));
  mock(t, prisma.chatSession, 'findUnique', async () => ({ userId: 'owner', state: 'COMPLETED', context: {} }));
  mock(t, prisma.serviceRequest, 'findFirst', async () => ({ id: 'active' }));
  await assert.rejects(new ChatService().restartSession('old', 'owner'), { status: 409 });
});
