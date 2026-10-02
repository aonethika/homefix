import 'dotenv/config';
import { randomUUID, createHash } from 'node:crypto';
import { S3Client, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../lib/prisma.js';

export const UPLOAD_TYPES = Object.freeze({
  profile: ['image/jpeg', 'image/png'], pan: ['image/jpeg', 'image/png', 'application/pdf'],
  face_front: ['image/jpeg'], face_left: ['image/jpeg'], face_right: ['image/jpeg'],
});
export const UPLOAD_FIELDS = Object.freeze({ profilePhotoKey: 'profile', panDocumentKey: 'pan', faceFrontKey: 'face_front', faceLeftKey: 'face_left', faceRightKey: 'face_right' });
export const MIN_UPLOAD_BYTES = 1024;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function uploadOwner(session) {
  if (typeof session !== 'string' || !/^[a-f0-9]{64}$/.test(session)) throw fail('Your upload session has expired. Re-upload the files in this browser.');
  return createHash('sha256').update(session).digest('hex');
}
export class StorageService {
  constructor({ db = prisma, client, signPost = createPresignedPost, signGet = getSignedUrl, env = process.env } = {}) {
    this.db = db; this.client = client; this.signPost = signPost; this.signGet = signGet; this.env = env;
  }
  get bucket() {
    if (!this.env.S3_BUCKET) throw fail('Private uploads are not configured. Please contact Zoon support.', 503);
    return this.env.S3_BUCKET;
  }
  get s3() {
    if (!this.client) this.client = new S3Client({ region: this.env.AWS_REGION || 'ap-south-1', endpoint: this.env.S3_ENDPOINT || undefined, forcePathStyle: Boolean(this.env.S3_ENDPOINT) });
    return this.client;
  }
  async presign({ purpose, contentType } = {}, session) {
    if (typeof purpose !== 'string' || !Object.hasOwn(UPLOAD_TYPES, purpose)) throw fail('Unsupported upload purpose');
    if (!UPLOAD_TYPES[purpose].includes(contentType)) throw fail('Unsupported upload type for this purpose');
    const ownerHash = uploadOwner(session);
    const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'pdf';
    const key = `pending/${purpose}/${randomUUID()}.${ext}`;
    const ticket = await this.signPost(this.s3, {
      Bucket: this.bucket, Key: key, Expires: 300,
      Fields: { 'Content-Type': contentType },
      Conditions: [['content-length-range', MIN_UPLOAD_BYTES, MAX_UPLOAD_BYTES], ['eq', '$Content-Type', contentType]],
    });
    await this.db.pendingUpload.create({ data: { key, ownerHash, purpose, contentType, expiresAt: new Date(Date.now() + 86400_000) } });
    return { ...ticket, key };
  }
  async claim(keys, session, registrationId) {
    const ownerHash = uploadOwner(session);
    // Never HEAD, copy or delete a client key until its ticket and owner have been checked.
    for (const [field, purpose] of Object.entries(UPLOAD_FIELDS)) {
      if (typeof keys[field] !== 'string' || !new RegExp(`^pending/${purpose}/[a-f0-9-]{36}\\.(jpg|png|pdf)$`).test(keys[field])) throw fail('Invalid upload key. Re-upload the affected file.');
    }
    await this.db.$transaction(async tx => {
      for (const [field, purpose] of Object.entries(UPLOAD_FIELDS)) {
        const result = await tx.pendingUpload.updateMany({ where: { key: keys[field], ownerHash, purpose, usedAt: null, claimId: null, expiresAt: { gt: new Date() } }, data: { claimId: registrationId } });
        if (result.count !== 1) throw fail('An upload is expired, already in use, or belongs to another application. Re-upload it.', 409);
      }
    });
  }
  async head(key) {
    try { return await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); }
    catch (error) {
      if (error.$metadata?.httpStatusCode === 404 || ['NotFound', 'NoSuchKey'].includes(error.name)) throw fail('A file was not uploaded. Re-upload it and try again.');
      throw fail('Private file storage is temporarily unavailable', 503);
    }
  }
  validateHead(head, purpose) {
    if (!UPLOAD_TYPES[purpose].includes(head.ContentType) || !Number.isFinite(head.ContentLength) || head.ContentLength < MIN_UPLOAD_BYTES || head.ContentLength > MAX_UPLOAD_BYTES) throw fail(`The ${purpose.replaceAll('_', ' ')} file must have an allowed type and be between 1 KB and 5 MB.`);
  }
  async copyChecked(source, destination, purpose) {
    const head = await this.head(source);
    this.validateHead(head, purpose);
    if (!head.ETag) throw fail('The uploaded file could not be validated. Please upload it again.');
    try {
      await this.s3.send(new CopyObjectCommand({ Bucket: this.bucket, Key: destination, CopySource: `${this.bucket}/${source.split('/').map(encodeURIComponent).join('/')}`, CopySourceIfMatch: head.ETag }));
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 412) throw fail('An upload changed while submitting. Please try again.');
      throw fail('Private file storage is temporarily unavailable', 503);
    }
    // Verify immutable copies as well, including their metadata and length.
    this.validateHead(await this.head(destination), purpose);
  }
  async delete(key) { return this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
  async cleanup(keys) { await Promise.allSettled(keys.map(key => this.delete(key))); }
  async release(registrationId) { await this.db.pendingUpload.updateMany({ where: { claimId: registrationId, usedAt: null }, data: { claimId: null } }); }
  async consume(tx, registrationId) {
    const result = await tx.pendingUpload.updateMany({ where: { claimId: registrationId, usedAt: null }, data: { usedAt: new Date() } });
    if (result.count !== 5) throw fail('The upload session changed. Please try again.', 409);
  }
  async signedGet(key) {
    return this.signGet(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseCacheControl: 'private, no-store' }), { expiresIn: 300 });
  }
}
export const storageService = new StorageService();
