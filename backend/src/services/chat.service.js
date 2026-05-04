import prisma from '../lib/prisma.js';
import { analyzeIntent } from '../utils/detectIntent.js';
import { ReplyService } from './reply.service.js';
import { RequestService } from './request.service.js';
import { MatchingService } from './matching.service.js';
import { calculateDistance } from '../utils/distance.js';

const replyService = new ReplyService();
const requestService = new RequestService();
const matchingService = new MatchingService();

export class ChatService {
  async getOrCreateSession(userId) {
    // Find active session (not completed/cancelled)
    let session = await prisma.chatSession.findFirst({
      where: {
        userId,
        state: { notIn: ['COMPLETED'] },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        request: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      session = await prisma.chatSession.create({
        data: { userId, state: 'INIT', context: {} },
        include: { messages: true, request: true },
      });
    }

    return session;
  }

  async createSession(userId) {
    return prisma.chatSession.create({
      data: { userId, state: 'INIT', context: {} },
      include: { messages: true, request: true },
    });
  }

  async processMessage(sessionId, userId, userMessage) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { request: true },
    });

    if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });

    // Save user message
    await this.saveMessage(sessionId, 'user', userMessage);

    const intent = analyzeIntent(userMessage);
    let botReply = '';
    let newState = session.state;
    let metadata = {};
    const ctx = session.context || {};

    // Handle cancel intent globally
    if (intent.wantsCancel && session.state !== 'INIT') {
      if (session.request) {
        await prisma.serviceRequest.update({
          where: { id: session.request.id },
          data: { status: 'CANCELLED' },
        });
      }
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { state: 'INIT', context: {} },
      });
      botReply = replyService.cancelled();
      await this.saveMessage(sessionId, 'bot', botReply);
      return { reply: botReply, state: 'INIT', metadata };
    }

    switch (session.state) {
      case 'INIT': {
        if (intent.serviceType) {
          newState = 'ISSUE_CAPTURED';
          const newCtx = { ...ctx, serviceType: intent.serviceType, description: userMessage, urgency: intent.urgency };
          await prisma.chatSession.update({ where: { id: sessionId }, data: { state: newState, context: newCtx } });
          botReply = replyService.serviceDetected(intent.serviceType, userMessage);
        } else {
          botReply = replyService.greeting();
        }
        break;
      }

      case 'ISSUE_CAPTURED': {
        // User is providing location
        const { serviceType, description } = ctx;
        let lat = null, lon = null, address = userMessage;

        // Try to parse coords if provided (e.g. from geolocation "12.34,67.89")
        const coordMatch = userMessage.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lon = parseFloat(coordMatch[2]);
          address = ctx.address || userMessage;
        }

        newState = 'SEARCHING';
        const newCtx = { ...ctx, userLat: lat, userLon: lon, userAddress: address };
        await prisma.chatSession.update({ where: { id: sessionId }, data: { state: newState, context: newCtx } });

        botReply = replyService.searching(serviceType);
        await this.saveMessage(sessionId, 'bot', botReply);

        // Create request
        const request = await requestService.createRequest({
          sessionId,
          userId,
          serviceType,
          description,
          userLatitude: lat,
          userLongitude: lon,
          userAddress: address,
        });

        // Find and assign worker
        const result = await requestService.assignWorker(request.id, lat, lon, serviceType);

        if (result) {
          const { worker } = result;
          const distance = (lat && lon && worker.latitude && worker.longitude)
            ? calculateDistance(lat, lon, worker.latitude, worker.longitude)
            : null;

          newState = 'ASSIGNED';
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: { state: newState, context: { ...newCtx, workerId: worker.id, requestId: request.id } },
          });
          botReply = replyService.workerFound(worker.user.name, serviceType, distance);
          metadata = { workerAssigned: true, workerName: worker.user.name, requestId: request.id };
        } else {
          newState = 'ISSUE_CAPTURED';
          await prisma.chatSession.update({
            where: { id: sessionId },
            data: { state: newState, context: newCtx },
          });
          botReply = replyService.noWorkerFound(serviceType);
        }
        await this.saveMessage(sessionId, 'bot', botReply, metadata);
        return { reply: botReply, state: newState, metadata };
      }

      case 'ASSIGNED': {
        botReply = "Your request has been assigned to a worker. Please wait for them to accept. You'll be notified shortly! 🔔";
        break;
      }

      case 'AWAITING_PRICE': {
        // Worker has set a price, waiting for user approval
        const { requestId, proposedPrice } = ctx;
        if (intent.wantsConfirm) {
          newState = 'PAYMENT_PENDING';
          await prisma.chatSession.update({ where: { id: sessionId }, data: { state: newState } });
          await prisma.serviceRequest.update({
            where: { id: requestId },
            data: { userApproved: true, status: 'PAYMENT_PENDING', finalPrice: proposedPrice },
          });
          botReply = replyService.paymentPending(proposedPrice);
          metadata = { action: 'INITIATE_PAYMENT', requestId, amount: proposedPrice };
        } else if (intent.wantsReject) {
          botReply = `You've declined the price. Please discuss with the service worker directly or cancel the request.`;
        } else {
          botReply = `The worker has proposed **₹${proposedPrice}** for this service. Reply **Yes** to approve and pay, or **No** to decline.`;
        }
        break;
      }

      case 'PAYMENT_PENDING': {
        botReply = `Your payment is pending. Please use the payment button to complete the transaction. 💳`;
        metadata = { action: 'SHOW_PAYMENT', requestId: ctx.requestId, amount: ctx.proposedPrice };
        break;
      }

      case 'COMPLETED': {
        botReply = `Your service has been completed! Is there anything else I can help you with? Start a new chat to book another service. 🏠`;
        break;
      }

      default:
        botReply = replyService.unknown();
    }

    await this.saveMessage(sessionId, 'bot', botReply, metadata);
    return { reply: botReply, state: newState, metadata };
  }

  async saveMessage(sessionId, role, content, metadata = null) {
    return prisma.chatMessage.create({
      data: { sessionId, role, content, metadata },
    });
  }

  async getSessionMessages(sessionId, userId) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        request: {
          include: {
            worker: { include: { user: { select: { id: true, name: true, phone: true } } } },
            payment: true,
            rating: true,
          },
        },
      },
    });
    if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
    return session;
  }

  async getUserSessions(userId) {
    return prisma.chatSession.findMany({
      where: { userId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        request: { select: { id: true, status: true, serviceType: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async handlePriceNotification(sessionId, proposedPrice, workerName) {
    const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) return;

    const ctx = session.context || {};
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        state: 'AWAITING_PRICE',
        context: { ...ctx, proposedPrice },
      },
    });

    const botReply = replyService.priceProposed(workerName, proposedPrice);
    await this.saveMessage(sessionId, 'bot', botReply, {
      action: 'PRICE_APPROVAL',
      proposedPrice,
      workerName,
    });

    return botReply;
  }

  async markSessionCompleted(sessionId) {
    return prisma.chatSession.update({
      where: { id: sessionId },
      data: { state: 'COMPLETED' },
    });
  }
}
