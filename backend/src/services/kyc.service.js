import 'dotenv/config';
import { RekognitionClient, DetectFacesCommand, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { TextractClient, DetectDocumentTextCommand, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import prisma from '../lib/prisma.js';
import { storageService } from './storage.service.js';
import { buildPanRequest, mapPanResponse, PAN_PROVIDER_ADAPTER_READY } from './pan-provider.adapter.js';

export const FACE_THRESHOLDS = Object.freeze({ maxYaw: 25, maxPitch: 25, minSideYaw: 20, minSharpness: 50, minBrightness: 30, frontSimilarity: 90, sideSimilarity: 75 });
const unavailable = message => Object.assign(new Error(message), { status: 503 });
export const normalizeName = value => String(value || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean);
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
export function namesMatch(first, second, { ocr = false } = {}) {
  const a = normalizeName(first), b = normalizeName(second);
  if (!a.length || !b.length) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length === 1 && longer.length !== 1) return false;
  const matches = (x, y) => x === y || ((x.length === 1 || y.length === 1) && x[0] === y[0]) || (ocr && x.length > 4 && y.length > 4 && distance(x, y) <= 1);
  // One-to-one token matching, so a repeated token cannot count twice.
  const assigned = new Map();
  const match = (index, visited) => {
    for (let j = 0; j < longer.length; j++) {
      if (visited.has(j) || !matches(shorter[index], longer[j])) continue;
      visited.add(j);
      if (!assigned.has(j) || match(assigned.get(j), visited)) { assigned.set(j, index); return true; }
    }
    return false;
  };
  return shorter.every((_, i) => match(i, new Set()));
}

async function readDocumentText(textract, key, bucket, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (!key.toLowerCase().endsWith('.pdf')) {
    return textract.send(new DetectDocumentTextCommand({ Document: { S3Object: { Bucket: bucket, Name: key } } }));
  }

  const { JobId } = await textract.send(new StartDocumentTextDetectionCommand({
    DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
  }));
  if (!JobId) throw new Error('Textract did not return a document job id');
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await wait(1000);
    const blocks = [];
    let nextToken;
    let status;
    do {
      const result = await textract.send(new GetDocumentTextDetectionCommand({ JobId, ...(nextToken ? { NextToken: nextToken } : {}) }));
      status = result.JobStatus;
      if (status === 'FAILED') throw new Error('Textract document job failed');
      if (status === 'SUCCEEDED') blocks.push(...(result.Blocks || []));
      nextToken = status === 'SUCCEEDED' ? result.NextToken : undefined;
    } while (nextToken);
    if (status === 'SUCCEEDED') return { Blocks: blocks };
    if (status !== 'IN_PROGRESS') throw new Error('Textract returned an unknown document job status');
  }
  throw new Error('Textract document job timed out');
}

export async function verifyKyc(input, deps = {}) {
  const env = deps.env || process.env;
  const errors = [], manual = [];
  const aiEnabled = ['on', 'true', '1'].includes(String(env.AWS_AI_CHECKS || '').trim().toLowerCase());
  const panProviderConfigured = Boolean(env.PAN_API_URL && env.PAN_API_KEY);
  const panAdapterReady = Boolean((deps.buildPanRequest && deps.mapPanResponse) || PAN_PROVIDER_ADAPTER_READY);
  const report = {
    pan: { checked: false, passed: false },
    document: { checked: false, passed: false },
    face: { checked: false, passed: false, details: {} },
    configuration: { awsAiChecksEnabled: aiEnabled, panProviderConfigured, panProviderAdapterReady: panAdapterReady },
  };
  const pan = String(input.panNumber || '').trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.push('Enter a valid 10-character PAN number.');
  if (panProviderConfigured && panAdapterReady) {
    try {
      const request = (deps.buildPanRequest || buildPanRequest)({ panNumber: pan, apiKey: env.PAN_API_KEY });
      const response = await (deps.fetch || globalThis.fetch)(env.PAN_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...request.headers }, body: JSON.stringify(request.body), signal: AbortSignal.timeout(15000), redirect: 'error' });
      if ([401, 403, 429].includes(response.status) || response.status >= 500) throw unavailable('PAN verification is temporarily unavailable');
      const result = (deps.mapPanResponse || mapPanResponse)(await response.json(), response.status);
      if (typeof result?.found !== 'boolean' || (result.found && typeof result.registeredName !== 'string')) throw unavailable('PAN verification is temporarily unavailable');
      report.pan.checked = true;
      if (!result.found) errors.push('PAN not found. Please check your PAN number.');
      else if (!namesMatch(input.name, result.registeredName)) errors.push('Your name must match the name on your PAN card.');
      else report.pan.passed = true;
    } catch { throw unavailable('PAN verification is temporarily unavailable'); }
  } else if (!panProviderConfigured) {
    manual.push('PAN official-record lookup was not run: configure PAN_API_URL and PAN_API_KEY');
  } else {
    manual.push('PAN provider credentials exist, but its documented request/response adapter is not implemented');
  }

  if (aiEnabled) {
    const textract = deps.textract || new TextractClient({ region: env.AWS_REGION || 'ap-south-1', maxAttempts: 2 });
    report.document.checked = true;
    try {
      const result = await readDocumentText(textract, input.panDocumentKey, env.S3_BUCKET, deps.wait);
      const lines = (result.Blocks || []).filter(b => b.BlockType === 'LINE').map(b => String(b.Text || '').trim());
      const readPan = lines.join(' ').toUpperCase().match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/)?.[0];
      // Exact holder label only; never use Father's Name as the holder's name.
      const label = lines.findIndex(line => /^name\s*:?$/i.test(line));
      const inline = lines.find(line => /^name\s*:\s*\S/i.test(line));
      const readName = inline ? inline.replace(/^name\s*:\s*/i, '') : label >= 0 ? lines[label + 1] : undefined;
      if (readPan && readPan !== pan) errors.push('The PAN number on the document differs from the number you entered.');
      if (readName && !namesMatch(input.name, readName, { ocr: true })) errors.push('The name on the PAN document differs from your name. Please check it or upload a clearer scan.');
      report.document = { checked: true, passed: Boolean(readPan === pan && readName && namesMatch(input.name, readName, { ocr: true })), numberRead: Boolean(readPan), nameRead: Boolean(readName) };
      if (!readPan || !readName) {
        report.document.reason = 'Textract did not confidently read both the entered PAN number and the card holder name.';
        manual.push('PAN document number/name could not both be read; admin must compare the original');
      }
    } catch (error) {
      report.document.reason = ['AccessDeniedException', 'UnrecognizedClientException', 'InvalidSignatureException'].includes(error.name)
        ? 'AWS Textract access failed; check the backend IAM policy, credentials, and bucket region.'
        : error.name === 'UnsupportedDocumentException'
          ? 'This document format is not supported by Textract.'
          : error.name === 'InvalidS3ObjectException'
            ? 'Textract could not read the private S3 object; check bucket region and permissions.'
            : 'PAN document could not be read by Textract; check scan quality, PDF password, and page count.';
      manual.push(report.document.reason);
    }

    const rekognition = deps.rekognition || new RekognitionClient({ region: env.AWS_REGION || 'ap-south-1', maxAttempts: 2 });
    const fields = { profile: input.profilePhotoKey, front: input.faceFrontKey, left: input.faceLeftKey, right: input.faceRightKey };
    const labels = { profile: 'Profile photo', front: 'Front camera photo', left: 'Left camera photo', right: 'Right camera photo' };
    const faces = {};
    let faceServiceUnavailable = false;
    const faceErrorsStart = errors.length;
    const image = key => ({ S3Object: { Bucket: env.S3_BUCKET, Name: key } });
    report.face.checked = true;
    for (const [field, key] of Object.entries(fields)) {
      try {
        const result = await rekognition.send(new DetectFacesCommand({ Image: image(key), Attributes: ['ALL'] }));
        if (result.FaceDetails?.length !== 1) { errors.push(`${labels[field]}: include exactly one face.`); continue; }
        const face = result.FaceDetails[0];
        const yaw = face.Pose?.Yaw, pitch = face.Pose?.Pitch;
        const sharpness = face.Quality?.Sharpness, brightness = face.Quality?.Brightness;
        faces[field] = { yaw, pitch };
        if (face.Sunglasses?.Value === true) errors.push(`${labels[field]}: remove sunglasses and retake.`);
        if (!Number.isFinite(sharpness) || !Number.isFinite(brightness) || sharpness < FACE_THRESHOLDS.minSharpness || brightness < FACE_THRESHOLDS.minBrightness) errors.push(`${labels[field]}: use brighter lighting, hold still and retake a sharp photo.`);
        if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) errors.push(`${labels[field]}: face angle could not be measured. Retake the photo.`);
        else if (['profile', 'front'].includes(field) && (Math.abs(yaw) > FACE_THRESHOLDS.maxYaw || Math.abs(pitch) > FACE_THRESHOLDS.maxPitch)) errors.push(`${labels[field]}: look straight into the camera with your head level.`);
        else if (['left', 'right'].includes(field) && (Math.abs(yaw) < FACE_THRESHOLDS.minSideYaw || Math.abs(pitch) > FACE_THRESHOLDS.maxPitch)) errors.push(`${labels[field]}: turn your head further to the ${field}, keeping it level.`);
        report.face.details[field] = { measured: true, yaw: yaw ?? null, pitch: pitch ?? null, sharpness: sharpness ?? null, brightness: brightness ?? null, sunglasses: Boolean(face.Sunglasses?.Value) };
      } catch (error) {
        if (['InvalidImageFormatException', 'ImageTooLargeException', 'InvalidParameterException'].includes(error.name)) errors.push(`${labels[field]}: upload a clear, valid JPEG photo.`);
        else {
          faceServiceUnavailable = true;
          report.face.reason = ['AccessDeniedException', 'UnrecognizedClientException', 'InvalidSignatureException'].includes(error.name) ? 'AWS Rekognition access failed. Check IAM permissions, credentials and region, then rerun checks.' : 'Face checking service could not finish. Retry automatic checks or perform a manual review.';
          manual.push(report.face.reason);
          break;
        }
      }
    }
    if (Number.isFinite(faces.left?.yaw) && Number.isFinite(faces.right?.yaw) && faces.left.yaw * faces.right.yaw >= 0) errors.push('Left and right camera photos: turn in opposite directions and retake both side photos.');
    for (const field of ['front', 'left', 'right']) {
      if (faceServiceUnavailable || !faces.profile || !faces[field]) continue;
      const threshold = field === 'front' ? FACE_THRESHOLDS.frontSimilarity : FACE_THRESHOLDS.sideSimilarity;
      try {
        const result = await rekognition.send(new CompareFacesCommand({ SourceImage: image(fields.profile), TargetImage: image(fields[field]), SimilarityThreshold: threshold }));
        const similarity = Math.max(0, ...(result.FaceMatches || []).map(m => m.Similarity || 0));
        report.face.details[`${field}Match`] = { similarity, passed: similarity >= threshold };
        if (similarity < threshold) errors.push(`${labels[field]} does not match your profile photo. Retake it with the same person clearly visible.`);
      } catch (error) {
        if (error.name === 'InvalidParameterException') errors.push(`${labels[field]} could not be compared. Retake it with your face clearly visible.`);
        else {
          faceServiceUnavailable = true;
          report.face.reason = ['AccessDeniedException', 'UnrecognizedClientException', 'InvalidSignatureException'].includes(error.name) ? 'AWS Rekognition access failed. Check IAM permissions, credentials and region, then rerun checks.' : 'Face checking service could not finish. Retry automatic checks or perform a manual review.';
          manual.push(report.face.reason);
          break;
        }
      }
    }
    report.face.passed = !faceServiceUnavailable && errors.length === faceErrorsStart && Object.keys(faces).length === 4 && ['front', 'left', 'right'].every(k => report.face.details[`${k}Match`]?.passed);
  } else {
    manual.push('AWS automatic document and face checks were not run: set AWS_AI_CHECKS=on and restart the backend');
  }
  report.manualReview = manual;
  report.errors = errors;
  return { ok: !errors.length, errors, report, panVerified: report.pan.passed, faceVerified: report.face.passed, note: manual.length ? `Needs manual review: ${manual.join('; ')}. Admin approval required.` : 'Automatic checks passed. Awaiting admin approval.' };
}

export async function getWorkerDocumentUrls(workerId, { db = prisma, storage = storageService } = {}) {
  const worker = await db.workerProfile.findUnique({ where: { id: workerId }, select: { profilePhotoKey: true, panDocumentKey: true, faceFrontKey: true, faceLeftKey: true, faceRightKey: true, idDocumentName: true } });
  if (!worker) return null;
  const urls = { expiresAt: new Date(Date.now() + 300_000).toISOString(), legacyDocument: Boolean(worker.idDocumentName && !worker.panDocumentKey) };
  for (const field of ['profilePhoto', 'panDocument', 'faceFront', 'faceLeft', 'faceRight']) urls[`${field}Url`] = worker[`${field}Key`] ? await storage.signedGet(worker[`${field}Key`]) : null;
  return urls;
}
