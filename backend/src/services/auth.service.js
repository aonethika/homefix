import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../lib/prisma.js';
import { storageService, UPLOAD_FIELDS } from './storage.service.js';
import { sendPasswordOtp } from './email.service.js';
import { verifyKyc } from './kyc.service.js';

export class AuthService {
  constructor({ db = prisma, storage = storageService, verify = verifyKyc } = {}) {
    this.db = db; this.storage = storage; this.verify = verify;
  }
  sanitizeUser(user) {
    const { password, ...safeUser } = user;
    if (safeUser.workerProfile) {
      const { idDocument, idDocumentName, idDocumentMime, panDocumentKey, faceFrontKey, faceLeftKey, faceRightKey, kycReport, ...safeProfile } = safeUser.workerProfile;
      if (kycReport) {
        safeProfile.verification = {
          face: safeProfile.faceVerified ? 'PASSED' : kycReport.face?.reason || !kycReport.face?.checked ? 'REVIEW_NEEDED' : 'NOT_PASSED',
          document: kycReport.document?.passed ? 'PASSED' : 'REVIEW_NEEDED',
          pan: safeProfile.panVerified ? 'PASSED' : 'REVIEW_NEEDED',
        };
        if (safeProfile.applicationStatus === 'PENDING') safeProfile.applicationNote = 'Your documents have been received. Some identity checks may need a manual review before an admin approves your account.';
      }
      safeUser.workerProfile = safeProfile;
    }
    return safeUser;
  }

  async register({ name, email, password, phone, latitude, longitude, address }) {
    const safeRole = 'USER';
    if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 8) {
      throw Object.assign(new Error('Name, valid email, and an 8 character password are required'), { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      const err = new Error('Email already registered');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone,
        role: safeRole,
        latitude,
        longitude,
        address,
      },
      include: { workerProfile: true },
    });

    const token = this.generateToken(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  async registerProfessional(payload, uploadSession) {
    const {
      name,
      email,
      password,
      phone,
      categoryKey,
      categoryKeys,
      customCategory,
      categoryDescription,
      latitude,
      longitude,
      address,
      bio,
      panNumber,
      profilePhotoKey,
      panDocumentKey,
      faceFrontKey,
      faceLeftKey,
      faceRightKey,
    } = payload || {};

    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8) {
      throw Object.assign(new Error('Name, valid email, and an 8 character password are required'), { status: 400 });
    }
    if (customCategory !== undefined && typeof customCategory !== 'string') throw Object.assign(new Error('Invalid service category'), { status: 400 });
    const selectedKeys = [...new Set((Array.isArray(categoryKeys) ? categoryKeys : [categoryKey]).filter(Boolean))];
    if (!selectedKeys.length && !customCategory?.trim()) throw Object.assign(new Error('Choose at least one service or request a new category'), { status: 400 });
    const normalizedPan = String(panNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) throw Object.assign(new Error('Enter a valid 10-character PAN number'), { status: 400 });
    if (!profilePhotoKey || !panDocumentKey || !faceFrontKey || !faceLeftKey || !faceRightKey) {
      throw Object.assign(new Error('Upload your PAN card and profile photo, and complete the camera check'), { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email: normalizedEmail } })) throw Object.assign(new Error('Email already registered'), { status: 409 });
    if (await this.db.workerProfile.findFirst({ where: { panNumber: normalizedPan } })) throw Object.assign(new Error('Another professional already registered with that PAN number'), { status: 409 });

    const approvedCategories = selectedKeys.length ? await this.db.serviceCategory.findMany({ where: { key: { in: selectedKeys }, status: 'APPROVED' } }) : [];
    if (approvedCategories.length !== selectedKeys.length) throw Object.assign(new Error('One or more selected services are unavailable'), { status: 400 });

    const customKey = customCategory?.trim() ? customCategory.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') : null;
    if (customCategory?.trim() && !customKey) throw Object.assign(new Error('Enter a valid service category name'), { status: 400 });
    const selectedKey = selectedKeys[0] || customKey;
    const legacyType = ['PLUMBER', 'ELECTRICIAN', 'AC_TECHNICIAN', 'CARPENTER'].includes(selectedKey) ? selectedKey : null;
    const keys = { profilePhotoKey, panDocumentKey, faceFrontKey, faceLeftKey, faceRightKey };
    const registrationId = randomUUID();
    const userId = randomUUID();
    const token = this.generateToken(userId);
    const finalKeys = {}, copyKeys = [];
    let claimed = false, committed = false;
    try {
      await this.storage.claim(keys, uploadSession, registrationId);
      claimed = true;
      for (const [field, purpose] of Object.entries(UPLOAD_FIELDS)) {
        const destination = `professionals/${registrationId}/${purpose}/${keys[field].split('/').pop()}`;
        // Track before copying so even partial or ambiguous copy failures are cleaned up.
        copyKeys.push(destination);
        await this.storage.copyChecked(keys[field], destination, purpose);
        finalKeys[field] = destination;
      }

      const verification = await this.verify({
        name: name.trim(),
        panNumber: normalizedPan,
        profilePhotoKey: finalKeys.profilePhotoKey,
        panDocumentKey: finalKeys.panDocumentKey,
        faceFrontKey: finalKeys.faceFrontKey,
        faceLeftKey: finalKeys.faceLeftKey,
        faceRightKey: finalKeys.faceRightKey,
      });

      if (!verification.ok) {
        throw Object.assign(new Error((verification.errors || []).join('. ') || 'KYC verification failed'), { status: 422 });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await this.db.$transaction(async tx => {
        const created = await tx.user.create({
          data: {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone,
            role: 'WORKER',
            latitude,
            longitude,
            address,
            workerProfile: {
              create: {
                serviceType: legacyType,
                serviceKey: selectedKey,
                latitude,
                longitude,
                address,
                bio,
                panNumber: normalizedPan,
                profilePhotoKey: finalKeys.profilePhotoKey,
                panDocumentKey: finalKeys.panDocumentKey,
                faceFrontKey: finalKeys.faceFrontKey,
                faceLeftKey: finalKeys.faceLeftKey,
                faceRightKey: finalKeys.faceRightKey,
                panVerified: verification.panVerified,
                faceVerified: verification.faceVerified,
                kycReport: verification.report,
                applicationStatus: 'PENDING',
                applicationNote: verification.note || 'Awaiting admin review.',
                isAvailable: false,
                services: { create: approvedCategories.map(category => ({ categoryId: category.id })) },
              },
            },
          },
          include: { workerProfile: true },
        });

        if (customKey) {
          const requestedCategory = await tx.serviceCategory.upsert({
            where: { key: customKey },
            create: { key: customKey, name: customCategory.trim(), description: categoryDescription?.trim() || null, keywords: [customCategory.trim().toLowerCase()], requestedById: created.id },
            update: {},
          });
          await tx.workerService.upsert({ where: { workerId_categoryId: { workerId: created.workerProfile.id, categoryId: requestedCategory.id } }, create: { workerId: created.workerProfile.id, categoryId: requestedCategory.id }, update: {} });
        }
        await this.storage.consume(tx, registrationId);
        return created;
      });

      committed = true;
      await this.storage.cleanup(Object.values(keys));
      return { user: this.sanitizeUser(user), token };
    } catch (error) {
      if (!committed) {
        await this.storage.cleanup(copyKeys);
        if (claimed) await this.storage.release(registrationId).catch(() => {});
      }
      if (error.code === 'P2002') throw Object.assign(new Error('Email or PAN is already registered'), { status: 409 });
      if (error.status) throw error;
      throw Object.assign(new Error('Professional registration is temporarily unavailable. Please try again.'), { status: 503 });
    }
  }

  async login({ email, password, portal }) {
    if (!email || !password) throw Object.assign(new Error('Email and password are required'), { status: 400 });
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { workerProfile: true },
    });

    if (!user) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('Invalid credentials');
      err.status = 401;
      throw err;
    }

    if (portal && user.role !== portal) {
      const destination = user.role === 'WORKER' ? 'Professional sign in (/professional-login)' : user.role === 'ADMIN' ? 'Admin sign in (/admin)' : 'Homeowner sign in (/login)';
      throw Object.assign(new Error(`This account uses ${destination}. Please sign in there.`), { status: 403 });
    }
    const token = this.generateToken(user.id);
    return { user: this.sanitizeUser(user), token };
  }

  generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  }

  async requestPasswordOtp(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return { message: 'If that email is registered, a reset code has been sent.' };
    const recent = await prisma.passwordResetOtp.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent) throw Object.assign(new Error('Please wait one minute before requesting another code'), { status: 429 });
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    await prisma.passwordResetOtp.create({ data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await sendPasswordOtp(normalizedEmail, code);
    return { message: 'If that email is registered, a reset code has been sent.', ...(process.env.NODE_ENV !== 'production' ? { developmentCode: code } : {}) };
  }

  async resetPassword({ email, code, password }) {
    if (typeof password !== 'string' || password.length < 8) throw Object.assign(new Error('Password must contain at least 8 characters'), { status: 400 });
    const user = await prisma.user.findUnique({ where: { email: String(email || '').trim().toLowerCase() } });
    if (!user) throw Object.assign(new Error('Invalid or expired reset code'), { status: 400 });
    const codeHash = crypto.createHash('sha256').update(String(code || '')).digest('hex');
    const otp = await prisma.passwordResetOtp.findFirst({ where: { userId: user.id, codeHash, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!otp) throw Object.assign(new Error('Invalid or expired reset code'), { status: 400 });
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
      prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetOtp.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    return { message: 'Password updated successfully' };
  }

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workerProfile: true },
    });
    if (!user) throw new Error('User not found');
    return this.sanitizeUser(user);
  }

  async updateProfile(userId, data) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
      },
      include: { workerProfile: true },
    });
    return this.sanitizeUser(user);
  }
}
