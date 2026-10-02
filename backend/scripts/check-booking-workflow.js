// Explicit integration check: all temporary records roll back, even if an assertion fails.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma.js';
import { BookingService } from '../src/services/booking.service.js';
const rollback = new Error('EXPECTED_TEST_ROLLBACK');
try {
  await prisma.$transaction(async tx => {
    const suffix = randomUUID();
    const home = await tx.user.create({ data: { name: 'Booking integration homeowner', email: `home-${suffix}@example.invalid`, password: 'not-a-login-hash' } });
    const pro = await tx.user.create({ data: { name: 'Booking integration professional', email: `pro-${suffix}@example.invalid`, password: 'not-a-login-hash', role: 'WORKER', workerProfile: { create: { isPublic: true, applicationStatus: 'APPROVED', serviceKey: 'PLUMBER' } } }, include: { workerProfile: true } });
    const session = await tx.chatSession.create({ data: { userId: home.id, state: 'ASSIGNED' } });
    const request = await tx.serviceRequest.create({ data: { userId: home.id, workerId: pro.workerProfile.id, sessionId: session.id, description: 'Test appointment', bookingStage: 'REQUESTED', status: 'ASSIGNED', expiresAt: new Date(Date.now() + 86400000) } });
    const service = new BookingService({ $transaction: fn => fn(tx) });
    await assert.rejects(service.change(request.id, home, 'schedule', { scheduledAt: new Date(Date.now() + 86400000).toISOString() }), { status: 409 });
    await service.change(request.id, pro, 'accept');
    const booked = await service.change(request.id, home, 'schedule', { scheduledAt: new Date(Date.now() + 86400000).toISOString() });
    assert.equal(booked.bookingStage, 'SCHEDULED');
    assert.equal(await tx.notification.count({ where: { userId: { in: [home.id, pro.id] } } }), 4);
    await service.change(request.id, pro, 'cancel', { reason: 'Integration test' });
    assert.equal((await tx.serviceRequest.findUnique({ where: { id: request.id } })).status, 'CANCELLED');
    assert.equal(await tx.chatMessage.count({ where: { sessionId: session.id } }), 3);
    throw rollback;
  }, { timeout: 30000, isolationLevel: 'Serializable' });
} catch (error) {
  if (error === rollback) console.log('PASS: real database acceptance, scheduling, notifications, history and cancellation; all test records rolled back.');
  else { console.error('Booking integration check failed:', error.code || error.name, error.name === 'AssertionError' ? error.message : 'Check database connectivity and schema.'); process.exitCode = 1; }
} finally { await prisma.$disconnect(); }
