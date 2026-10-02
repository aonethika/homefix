import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import razorpay from '../lib/razorpay.js';
import { getSocketIO } from '../socket/socket.js';
import { ChatService } from './chat.service.js';
import { sendNotification, notifyAdmins } from './notification.service.js';

const chatService = new ChatService();

export class PaymentService {
  async createOrder(requestId, userId) {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { payment: true },
    });

    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (request.userId !== userId) throw Object.assign(new Error('Unauthorized'), { status: 403 });
    if (!request.userApproved) throw Object.assign(new Error('Price not approved yet'), { status: 400 });
    if (!request.finalPrice) throw Object.assign(new Error('No price set'), { status: 400 });

    // Check existing pending payment
    if (request.payment && request.payment.status === 'PAID') {
      throw Object.assign(new Error('Already paid'), { status: 400 });
    }

    const amountPaise = Math.round(request.finalPrice * 100); // Convert to paise

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `zoon_${requestId.substring(0, 16)}`,
      notes: { requestId, userId },
    });

    // Upsert payment record
    const payment = await prisma.payment.upsert({
      where: { requestId },
      create: {
        requestId,
        razorpayOrderId: order.id,
        amount: request.finalPrice,
        status: 'CREATED',
      },
      update: {
        razorpayOrderId: order.id,
        status: 'CREATED',
      },
    });

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      paymentId: payment.id,
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  async verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature, requestId }, userId) {
    const existingPayment = await prisma.payment.findUnique({
      where: { requestId },
      include: { request: true },
    });
    if (!existingPayment || existingPayment.request.userId !== userId) {
      throw Object.assign(new Error('Payment not found'), { status: 404 });
    }
    if (existingPayment.razorpayOrderId !== razorpayOrderId) {
      throw Object.assign(new Error('Payment order does not match this request'), { status: 400 });
    }
    if (existingPayment.status === 'PAID') return existingPayment;
    // Verify signature
    const body = existingPayment.razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpaySignature) {
      throw Object.assign(new Error('Payment verification failed'), { status: 400 });
    }

    // Update payment
    const payment = await prisma.payment.update({
      where: { requestId },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        status: 'PAID',
      },
    });

    // Update request
    const request = await prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'PAID' },
      include: { worker: { include: { user: true } } },
    });
    if (request.workerId) await prisma.workerProfile.update({ where: { id: request.workerId }, data: { isAvailable: true } });

    // Notify via socket
    const io = getSocketIO();
    if (io) {
      io.to(`user:${request.userId}`).emit('payment:completed', { requestId, amount: request.finalPrice });
      if (request.workerId) {
        io.to(`worker:${request.worker.userId}`).emit('payment:completed', { requestId, amount: request.finalPrice });
      }
      io.to('admins').emit('admin:request-updated', { requestId, status: 'PAID' });
    }
    await sendNotification(request.userId, 'Payment confirmed', `Your payment of ₹${request.finalPrice} was successful.`, 'SUCCESS', { requestId });
    if (request.worker?.userId) await sendNotification(request.worker.userId, 'Payment received', `₹${request.finalPrice} was paid for your job.`, 'SUCCESS', { requestId });
    await notifyAdmins('Payment completed', `Payment of ₹${request.finalPrice} was completed.`, 'SUCCESS', { requestId });

    // Update chat session
    if (request.sessionId) {
      const botReply = `🎊 Payment of **₹${request.finalPrice}** received! Thank you! Please rate your service professional. ⭐`;
      await chatService.saveMessage(request.sessionId, 'bot', botReply, { action: 'SHOW_RATING', requestId });
      await chatService.markSessionCompleted(request.sessionId);
    }

    return payment;
  }

  async getPaymentByRequest(requestId, userId) {
    const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!request || request.userId !== userId) {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }
    return prisma.payment.findUnique({ where: { requestId } });
  }
}
