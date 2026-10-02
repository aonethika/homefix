import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService, UPLOAD_FIELDS, uploadOwner } from '../src/services/storage.service.js';
import { verifyKyc, namesMatch, getWorkerDocumentUrls } from '../src/services/kyc.service.js';
import { AuthService } from '../src/services/auth.service.js';
import prisma from '../src/lib/prisma.js';

const session = 'a'.repeat(64);
const env = { AWS_REGION: 'ap-south-1', S3_BUCKET: 'private-test-bucket', AWS_AI_CHECKS: 'off' };
const types = { profile: 'image/png', pan: 'application/pdf', face_front: 'image/jpeg', face_left: 'image/jpeg', face_right: 'image/jpeg' };
function fixture(t, { verification, duplicate = false, failCreate = false } = {}) {
  const keys = Object.fromEntries(Object.entries(UPLOAD_FIELDS).map(([field, purpose]) => [field, `pending/${purpose}/${randomUUID()}.${purpose === 'pan' ? 'pdf' : purpose === 'profile' ? 'png' : 'jpg'}`]));
  const payload = { name: 'Rajesh K Nair', email: 'applicant@example.test', password: 'long-test-password', panNumber: 'ABCDE1234F', categoryKeys: ['PLUMBER'], ...keys };
  const objects = new Map(Object.entries(keys).map(([field, key]) => [key, { ContentType: types[UPLOAD_FIELDS[field]], ContentLength: 2000, ETag: 'original' }]));
  let tickets = Object.entries(keys).map(([field, key]) => ({ key, purpose: UPLOAD_FIELDS[field], ownerHash: uploadOwner(session), claimId: null, usedAt: null, expiresAt: new Date(Date.now() + 86400_000) }));
  const users = [], commands = [];
  const db = {
    user: { findUnique: async () => null, create: async ({ data }) => { if (failCreate) throw new Error('Database unavailable'); users.push(data); return { ...data, workerProfile: { id: 'worker-id', ...data.workerProfile.create } }; } },
    workerProfile: { findFirst: async () => duplicate ? { id: 'other' } : null },
    serviceCategory: { findMany: async () => [{ id: 'plumbing', key: 'PLUMBER' }] },
    pendingUpload: { updateMany: async ({ where, data }) => {
      let count = 0;
      for (const ticket of tickets) {
        if (!Object.entries(where).every(([key, value]) => key === 'expiresAt' ? ticket.expiresAt > value.gt : ticket[key] === value)) continue;
        Object.assign(ticket, data); count++;
      }
      return { count };
    } },
    $transaction: async fn => { const snapshot = structuredClone(tickets), length = users.length; try { return await fn(db); } catch (e) { tickets = snapshot; users.length = length; throw e; } },
  };
  const client = { send: async command => {
    commands.push(command);
    const { Key, CopySource, CopySourceIfMatch } = command.input;
    switch (command.constructor.name) {
      case 'HeadObjectCommand': if (!objects.has(Key)) throw Object.assign(new Error('Missing'), { name: 'NotFound' }); return objects.get(Key);
      case 'CopyObjectCommand': { const source = objects.get(CopySource.slice(env.S3_BUCKET.length + 1)); assert.equal(CopySourceIfMatch, source.ETag); objects.set(Key, { ...source }); return {}; }
      case 'DeleteObjectCommand': objects.delete(Key); return {};
      default: throw new Error('Unexpected S3 command');
    }
  } };
  const storage = new StorageService({ db, client, env });
  const verify = t.mock.fn(verification || (input => verifyKyc(input, { env })));
  const auth = new AuthService({ db, storage, verify });
  t.mock.method(auth, 'generateToken', () => 'test-jwt');
  return { auth, db, storage, payload, keys, objects, users, commands, verify, tickets: () => tickets };
}
function stubPrisma(t, model, method, implementation) { const original = model[method]; model[method] = implementation; t.after(() => { model[method] = original; }); }

test('presign rejects unsupported and inherited purposes/types', async () => {
  const storage = new StorageService({ env });
  for (const body of [{ purpose: 'pan', contentType: 'image/webp' }, { purpose: 'face_left', contentType: 'application/pdf' }, { purpose: '__proto__', contentType: 'image/jpeg' }, { purpose: 'constructor', contentType: 'image/jpeg' }, { purpose: 'unknown', contentType: 'image/jpeg' }]) await assert.rejects(storage.presign(body, session), { status: 400 });
});
test('real signed POST policy locks key, content type, size and five-minute expiration without SSE parameter', async t => {
  const client = new S3Client({ region: env.AWS_REGION, credentials: { accessKeyId: 'TESTACCESSKEY', secretAccessKey: 'test-only-not-a-real-secret' } });
  const create = t.mock.fn(async () => ({}));
  const storage = new StorageService({ env, client, db: { pendingUpload: { create } } });
  const result = await storage.presign({ purpose: 'pan', contentType: 'application/pdf' }, session);
  const policy = JSON.parse(Buffer.from(result.fields.Policy, 'base64').toString());
  assert.match(result.key, /^pending\/pan\/[a-f0-9-]+\.pdf$/);
  assert.ok(policy.conditions.some(c => JSON.stringify(c) === JSON.stringify(['content-length-range', 1024, 5242880])));
  assert.ok(policy.conditions.some(c => JSON.stringify(c) === JSON.stringify(['eq', '$Content-Type', 'application/pdf'])));
  assert.ok(new Date(policy.expiration).getTime() - Date.now() <= 300000);
  assert.ok(new Date(policy.expiration).getTime() - Date.now() > 290000);
  assert.ok(!JSON.stringify(result.fields).includes('server-side-encryption'));
  assert.equal(create.mock.calls[0].arguments[0].data.ownerHash, uploadOwner(session));
});
test('all automatic checks off permits registration but requires every manual review and admin approval', async t => {
  const f = fixture(t);
  const result = await f.auth.registerProfessional(f.payload, session);
  assert.equal(f.users.length, 1);
  assert.equal(result.user.workerProfile.applicationStatus, 'PENDING');
  assert.equal(result.user.workerProfile.panVerified, false);
  assert.equal(result.user.workerProfile.faceVerified, false);
  assert.match(result.user.workerProfile.applicationNote, /manual review/);
  assert.match(f.users[0].workerProfile.create.applicationNote, /Needs manual review:.*official-record.*document.*face/);
  for (const key of Object.values(f.keys)) assert.equal(f.objects.has(key), false);
  assert.equal([...f.objects.keys()].filter(k => k.startsWith('professionals/')).length, 5);
  for (const field of Object.keys(UPLOAD_FIELDS)) assert.ok(f.verify.mock.calls[0].arguments[0][field].startsWith('professionals/'));
  assert.ok(f.tickets().every(ticket => ticket.usedAt));
});
const providerDeps = { env: { ...env, PAN_API_URL: 'https://provider.example.test', PAN_API_KEY: 'test-key' }, buildPanRequest: ({ panNumber }) => ({ headers: {}, body: { fixturePan: panNumber } }), mapPanResponse: payload => payload };
test('provider name mismatch gives 422, creates no user, deletes copies and retains pending files for retry', async t => {
  const f = fixture(t, { verification: input => verifyKyc(input, { ...providerDeps, fetch: async () => ({ status: 200, json: async () => ({ found: true, registeredName: 'Different Secret Name' }) }) }) });
  await assert.rejects(f.auth.registerProfessional(f.payload, session), error => error.status === 422 && error.message.includes('Your name must match the name on your PAN card.') && !error.message.includes('Different Secret Name'));
  assert.equal(f.users.length, 0);
  assert.deepEqual([...f.objects.keys()].sort(), Object.values(f.keys).sort());
  assert.ok(f.tickets().every(ticket => !ticket.claimId && !ticket.usedAt));
});
test('provider auth, rate-limit, server, malformed and network failures return 503', async () => {
  for (const status of [401, 403, 429, 500, 503]) await assert.rejects(verifyKyc({ name: 'Rajesh Nair', panNumber: 'ABCDE1234F' }, { ...providerDeps, fetch: async () => ({ status }) }), { status: 503, message: 'PAN verification is temporarily unavailable' });
  await assert.rejects(verifyKyc({ name: 'Rajesh Nair', panNumber: 'ABCDE1234F' }, { ...providerDeps, fetch: async () => { throw new Error('secret provider data'); } }), { status: 503, message: 'PAN verification is temporarily unavailable' });
});
test('configured PAN credentials without an implemented adapter are reported as manual, never verified', async () => {
  const result = await verifyKyc({ name: 'Rajesh Nair', panNumber: 'ABCDE1234F' }, { env: providerDeps.env });
  assert.equal(result.panVerified, false);
  assert.equal(result.report.pan.checked, false);
  assert.equal(result.report.configuration.panProviderAdapterReady, false);
  assert.ok(result.report.manualReview.some(item => item.includes('adapter is not implemented')));
});
test('missing camera shot is a 400 before any S3 activity', async t => {
  const f = fixture(t); delete f.payload.faceLeftKey;
  await assert.rejects(f.auth.registerProfessional(f.payload, session), { status: 400, message: 'Upload your PAN card and profile photo, and complete the camera check' });
  assert.equal(f.commands.length, 0);
});
test('never-uploaded file is a 400 and partial copies are removed', async t => {
  const f = fixture(t); f.objects.delete(f.keys.faceLeftKey);
  await assert.rejects(f.auth.registerProfessional(f.payload, session), { status: 400 });
  assert.equal(f.users.length, 0);
  assert.ok([...f.objects.keys()].every(k => k.startsWith('pending/')));
  assert.ok(f.tickets().every(ticket => !ticket.claimId));
});
test('duplicate PAN returns 409 before claiming or copying uploads', async t => {
  const f = fixture(t, { duplicate: true });
  await assert.rejects(f.auth.registerProfessional(f.payload, session), { status: 409 });
  assert.equal(f.commands.length, 0);
});
test('database failure deletes final copies and keeps reusable pending files', async t => {
  const f = fixture(t, { failCreate: true });
  await assert.rejects(f.auth.registerProfessional(f.payload, session), { status: 503 });
  assert.deepEqual([...f.objects.keys()].sort(), Object.values(f.keys).sort());
  assert.ok(f.tickets().every(ticket => !ticket.claimId && !ticket.usedAt));
});
test('another applicant cannot claim, copy or delete uploads owned by someone else', async t => {
  const f = fixture(t);
  await assert.rejects(f.auth.registerProfessional(f.payload, 'b'.repeat(64)), { status: 409 });
  assert.equal(f.commands.length, 0);
  assert.equal(f.objects.size, 5);
});
test('final keys and wrong-purpose pending keys cannot be submitted', async t => {
  const f = fixture(t);
  for (const key of ['professionals/other/pan/file.pdf', f.keys.profilePhotoKey]) await assert.rejects(f.auth.registerProfessional({ ...f.payload, panDocumentKey: key }, session), { status: 400 });
  assert.equal(f.commands.length, 0);
});
test('HEAD rejects wrong content types and size; no user is created', async t => {
  const f = fixture(t); f.objects.set(f.keys.profilePhotoKey, { ContentType: 'image/webp', ContentLength: 2000, ETag: 'original' });
  await assert.rejects(f.auth.registerProfessional(f.payload, session), { status: 400 });
  assert.equal(f.users.length, 0);
});
test('names require every shorter token, allow unique initials, and never use fuzzy provider matching', () => {
  assert.equal(namesMatch('Rajesh K Nair', 'RAJESH KUMAR NAIR'), true);
  assert.equal(namesMatch('Nair Rajesh K.', 'RAJESH KUMAR NAIR'), true);
  assert.equal(namesMatch('Kumar', 'RAJESH KUMAR NAIR'), false);
  assert.equal(namesMatch('Suresh Nair', 'RAJESH KUMAR NAIR'), false);
  assert.equal(namesMatch('Rajesh Alien Nair', 'RAJESH KUMAR NAIR'), false);
  assert.equal(namesMatch('Rajesh Rajesh', 'RAJESH KUMAR NAIR'), false);
  assert.equal(namesMatch('Rajesh Nair', 'RAJESH NAIR'), true);
  assert.equal(namesMatch('Rajesh Nair', 'RAJESN NAIR'), false);
  assert.equal(namesMatch('Rajesh Nair', 'RAJESN NAIR', { ocr: true }), true);
});
const faceInput = { name: 'Rajesh K Nair', panNumber: 'ABCDE1234F', profilePhotoKey: 'profile', panDocumentKey: 'pan', faceFrontKey: 'front', faceLeftKey: 'left', faceRightKey: 'right' };
function aiDeps({ left = -30, right = 30, sunglasses = false, sharpness = 90, frontYaw = 0, compare = 99, unreadable = false, lines = ['Name', 'RAJESH KUMAR NAIR', "Father's Name", 'OTHER PERSON', 'PAN ABCDE1234F'] } = {}) {
  return { env: { ...env, AWS_AI_CHECKS: 'on' }, textract: { send: async () => { if (unreadable) throw new Error('Unreadable'); return { Blocks: lines.map(Text => ({ BlockType: 'LINE', Text })) }; } }, rekognition: { send: async command => command.constructor.name === 'CompareFacesCommand' ? { FaceMatches: [{ Similarity: compare }] } : { FaceDetails: [{ Pose: { Yaw: ({ left, right, front: frontYaw })[command.input.Image.S3Object.Name] || 0, Pitch: 0 }, Sunglasses: { Value: sunglasses }, Eyeglasses: { Value: true }, Quality: { Sharpness: sharpness, Brightness: 70 } }] } } };
}
test('AWS face fields, opposite side poses and comparisons pass; ordinary glasses are allowed', async () => {
  const result = await verifyKyc(faceInput, aiDeps());
  assert.equal(result.ok, true); assert.equal(result.faceVerified, true); assert.equal(result.report.document.passed, true); assert.equal(result.panVerified, false);
  assert.equal((await verifyKyc(faceInput, aiDeps({ left: 30, right: -30 }))).faceVerified, true);
});
test('PDF PAN cards use Textract asynchronous document detection and validate OCR results', async () => {
  const deps = aiDeps();
  const commands = [];
  deps.wait = async () => {};
  deps.textract.send = async command => {
    commands.push(command.constructor.name);
    if (command.constructor.name === 'StartDocumentTextDetectionCommand') return { JobId: 'job-1' };
    if (command.constructor.name === 'GetDocumentTextDetectionCommand') return {
      JobStatus: 'SUCCEEDED',
      Blocks: ['Name', 'RAJESH KUMAR NAIR', 'PAN ABCDE1234F'].map(Text => ({ BlockType: 'LINE', Text })),
    };
    throw new Error(`Unexpected Textract command: ${command.constructor.name}`);
  };
  const result = await verifyKyc({ ...faceInput, panDocumentKey: 'professionals/app/pan/card.pdf' }, deps);
  assert.equal(result.report.document.passed, true);
  assert.deepEqual(commands, ['StartDocumentTextDetectionCommand', 'GetDocumentTextDetectionCommand']);
});
test('same-direction, frontal side shots, bad quality, sunglasses and mismatches fail face verification', async () => {
  for (const options of [{ left: 30, right: 35 }, { left: 2 }, { sharpness: 10 }, { sunglasses: true }, { frontYaw: 40 }, { compare: 60 }]) {
    const result = await verifyKyc(faceInput, aiDeps(options)); assert.equal(result.ok, false); assert.equal(result.faceVerified, false); assert.ok(result.errors.length);
  }
});
test('unreadable PAN falls back to manual review without pretending document checks passed', async () => {
  const result = await verifyKyc(faceInput, aiDeps({ unreadable: true }));
  assert.equal(result.ok, true); assert.equal(result.report.document.passed, false); assert.match(result.note, /could not be read/);
});
test('OCR ignores the father name, flags missing holder name, and rejects a different PAN substring', async () => {
  const missing = await verifyKyc(faceInput, aiDeps({ lines: ["Father's Name", 'OTHER PERSON', 'ABCDE1234F'] }));
  assert.equal(missing.ok, true); assert.match(missing.note, /could not both be read/);
  const wrong = await verifyKyc(faceInput, aiDeps({ lines: ['Name', 'RAJESH KUMAR NAIR', 'PAN: ZZZZZ9999Z'] }));
  assert.equal(wrong.ok, false); assert.ok(wrong.errors.some(e => e.includes('PAN number')));
});
test('register, login, getProfile and updateProfile sanitize private KYC fields', async t => {
  const f = fixture(t);
  const registered = await f.auth.registerProfessional(f.payload, session);
  const raw = { id: 'user', name: 'Rajesh', email: 'applicant@example.test', role: 'WORKER', password: await bcrypt.hash('test-password', 4), workerProfile: { ...f.users[0].workerProfile.create, idDocument: 'legacy-private-file' } };
  stubPrisma(t, prisma.user, 'findUnique', async () => raw);
  stubPrisma(t, prisma.user, 'update', async () => raw);
  const auth = new AuthService(); t.mock.method(auth, 'generateToken', () => 'test-jwt');
  const login = await auth.login({ email: raw.email, password: 'test-password', portal: 'WORKER' });
  const profile = await auth.getProfile('user');
  const updated = await auth.updateProfile('user', { name: 'Rajesh' });
  for (const result of [registered.user, login.user, profile, updated]) {
    for (const field of ['panDocumentKey', 'faceFrontKey', 'faceLeftKey', 'faceRightKey', 'kycReport', 'idDocument']) assert.equal(result.workerProfile[field], undefined);
    assert.equal(result.password, undefined);
  }
});
test('admin document URLs are generated only on request with five-minute expiry', async () => {
  const calls = [];
  const result = await getWorkerDocumentUrls('worker', { db: { workerProfile: { findUnique: async () => Object.fromEntries(Object.keys(UPLOAD_FIELDS).map(k => [k, `professionals/test/${k}`])) } }, storage: { signedGet: async key => { calls.push(key); return 'https://private.example.test/signed'; } } });
  assert.equal(calls.length, 5); assert.ok(result.panDocumentUrl); assert.ok(new Date(result.expiresAt).getTime() - Date.now() <= 300000);
});

test('face provider outages retain an unverified application for manual review', async () => {
  const deps = aiDeps();
  deps.rekognition = { send: async () => { throw Object.assign(new Error('private provider failure'), { name: 'AccessDeniedException' }); } };
  const result = await verifyKyc(faceInput, deps);
  assert.equal(result.ok, true);
  assert.equal(result.faceVerified, false);
  assert.equal(result.report.document.passed, true);
  assert.match(result.report.face.reason, /access failed/);
  assert.ok(result.report.manualReview.some(note => note.includes('Rekognition')));
});

test('professional account gets friendly check statuses without internal configuration notes', () => {
  const user = new AuthService().sanitizeUser({ id: 'professional', workerProfile: { applicationStatus: 'PENDING', applicationNote: 'Set AWS_AI_CHECKS and PAN_API_KEY', faceVerified: true, panVerified: false, kycReport: { face: { passed: true }, document: { passed: true } } } });
  assert.equal(user.workerProfile.verification.face, 'PASSED');
  assert.equal(user.workerProfile.verification.pan, 'REVIEW_NEEDED');
  assert.doesNotMatch(user.workerProfile.applicationNote, /AWS|PAN_API|backend/);
  assert.equal(user.workerProfile.kycReport, undefined);
});
