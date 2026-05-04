import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export class AuthService {
  async register({ name, email, password, phone, role, serviceType, latitude, longitude, address }) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const err = new Error('Email already registered');
      err.status = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: role || 'USER',
        latitude,
        longitude,
        address,
        ...(role === 'WORKER' && serviceType ? {
          workerProfile: {
            create: {
              serviceType,
              latitude,
              longitude,
              address,
            },
          },
        } : {}),
      },
      include: { workerProfile: true },
    });

    const token = this.generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  async login({ email, password }) {
    const user = await prisma.user.findUnique({
      where: { email },
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

    const token = this.generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
  }

  generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  }

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workerProfile: true },
    });
    if (!user) throw new Error('User not found');
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
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
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
