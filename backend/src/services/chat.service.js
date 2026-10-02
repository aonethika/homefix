import { chatLifecycle } from './chat-lifecycle.service.js';
import prisma from '../lib/prisma.js';
import { analyzeIntent } from '../utils/detectIntent.js';
import { ReplyService } from './reply.service.js';
import { RequestService, SAFETY_NOTICE_VERSION, workerSelect } from './request.service.js';
import { MatchingService } from './matching.service.js';
import { understandMessage } from './llm.service.js';

const replyService = new ReplyService();
const requestService = new RequestService();
const matchingService = new MatchingService();

export class ChatService {
  constructor({ understand = understandMessage } = {}) { this.understand = understand; }
  async getOrCreateSession(userId) { return this.createSession(userId); }

  async createSession(userId) {
    return prisma.$transaction(async tx => {
      const empty = await tx.chatSession.findFirst({ where: { userId, state: 'INIT', request: null, messages: { none: {} } }, include: { messages: true, request: true }, orderBy: { createdAt: 'desc' } });
      return empty || tx.chatSession.create({ data: { userId, state: 'INIT', context: {} }, include: { messages: true, request: true } });
    }, { isolationLevel: 'Serializable' });
  }

  // A delayed lookup must never reopen a stopped conversation.
  async updateOpenSession(args) {
    try { return await prisma.chatSession.update({ ...args, where: { ...args.where, state: { not: 'COMPLETED' } } }); }
    catch (error) { if (error.code === 'P2025') throw Object.assign(new Error('This conversation was closed. Start a new chat to search again.'), { status: 409 }); throw error; }
  }

  async restartSession(sessionId, userId) {
    return prisma.$transaction(async tx => {
      const old = await tx.chatSession.findUnique({ where: { id: sessionId }, include: { request: true } });
      if (!old || old.userId !== userId) throw Object.assign(new Error('Conversation not found'), { status: 404 });
      if (old.state !== 'COMPLETED' || (old.request && !['CANCELLED', 'REJECTED'].includes(old.request.status))) throw Object.assign(new Error('Close the current request before searching again.'), { status: 409 });
      const outstanding = await tx.serviceRequest.findFirst({ where: { userId, status: { notIn: ['CANCELLED', 'REJECTED', 'PAID'] }, OR: [{ payment: null }, { payment: { is: { status: { not: 'PAID' } } } }] } });
      if (outstanding) throw Object.assign(new Error('You already have an unfinished booking. Open My bookings to continue.'), { status: 409 });
      const ctx = old.context || {};
      const canSearch = ctx.serviceType && ctx.userLat != null && ctx.userLon != null;
      return tx.chatSession.create({ data: { userId, state: canSearch ? 'NEED_LOCATION' : 'INIT', context: canSearch ? { serviceType: ctx.serviceType, description: ctx.description, userLat: ctx.userLat, userLon: ctx.userLon, userAddress: ctx.userAddress, excludedWorkerId: old.request?.workerId } : {} }, include: { messages: true, request: true } });
    }, { isolationLevel: 'Serializable' });
  }

  async processMessage(sessionId, userId, userMessage, { safetyAcknowledged = false } = {}) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { request: true },
    });

    if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
    if (session.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    const requestedCandidate = session.context?.candidates?.find(candidate => userMessage === `SELECT_WORKER:${candidate.id}`);
    if (requestedCandidate && !safetyAcknowledged) throw Object.assign(new Error('Read and acknowledge the homeowner safety notice before sending a booking request.'), { status: 400 });

    // Save user message
    const chosen = session.context?.candidates?.find(candidate => userMessage === `SELECT_WORKER:${candidate.id}`);
    const displayMessage = chosen ? `Request ${chosen.name}` : session.state === 'NEED_LOCATION' && userMessage.includes('|') ? userMessage.split('|').slice(1).join('|').trim() : userMessage;
    await this.saveMessage(sessionId, 'user', displayMessage);

    let intent = analyzeIntent(userMessage);

    const isStructured = userMessage.startsWith('SELECT_WORKER:') || userMessage === 'Search again';
    const needsAI = !isStructured && ['INIT', 'ISSUE_CAPTURED', 'CHOOSE_WORKER', 'AWAITING_PRICE'].includes(session.state);

    if (needsAI) {
      try {
        const categories = await prisma.serviceCategory.findMany({ where: { status: 'APPROVED' } });
        const ai = await this.understand({ message: userMessage, state: session.state, categories });
 
        console.log('=====---====================================> AI RESULT:', ai, 'CATEGORIES:', categories.map(c => c.key));

        intent = {
          ...intent,
          serviceType: ai.serviceType ?? intent.serviceType,
          urgency: ai.urgency ?? intent.urgency,
          wantsConfirm: ai.intent === 'confirm' || intent.wantsConfirm,
          wantsReject: ai.intent === 'reject' || intent.wantsReject,
          wantsCancel: ai.intent === 'cancel' || intent.wantsCancel,
        };
      } catch (err) {
        console.warn('AI unavailable, using old logic:', err.message);
      }
    }
    if (!intent.serviceType) {
      const categories = await prisma.serviceCategory.findMany({ where: { status: 'APPROVED' } });
      const lowerMessage = userMessage.toLowerCase();
      const match = categories.find(category =>
        lowerMessage.includes(category.name.toLowerCase()) || category.keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()))
      );
      if (match) intent.serviceType = match.key;
    }
    let botReply = '';
    let newState = session.state;
    let metadata = {};
    const ctx = session.context || {};

    if ((intent.wantsCancel || /^(cancel|close|finish|stop searching)$/i.test(userMessage.trim())) && session.state !== 'INIT') {
      await chatLifecycle.stop({ userId, sessionId, pendingOnly: true });
      return { reply: 'Search stopped. Choose Find another professional when you are ready.', state: 'COMPLETED', metadata: { kind: 'CANCELLED', requestId: session.request?.id, requestStatus: session.request ? 'CANCELLED' : undefined } };
    }

    switch (session.state) {
      case 'INIT': {
        if (intent.serviceType) {
          newState = 'ISSUE_CAPTURED';
          const newCtx = { ...ctx, serviceType: intent.serviceType, description: userMessage, urgency: intent.urgency };
          await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: newCtx } });
          const serviceName = intent.serviceType === 'AC_TECHNICIAN' ? 'AC technician' : intent.serviceType.replaceAll('_', ' ').toLowerCase();
          botReply = `This sounds like a job for ${/^[aeiou]/i.test(serviceName) ? 'an' : 'a'} **${serviceName}**. Would you like to compare approved professionals near you?`;
          metadata = { action: 'CONFIRM_SERVICE', serviceType: intent.serviceType };
        } else {
          botReply = replyService.greeting();
        }
        break;
      }

      case 'ISSUE_CAPTURED': {
        if (intent.wantsReject) {
          newState = 'INIT';
          await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: {} } });
          botReply = 'No problem. Tell me a little more about the issue and I’ll identify the right professional.';
          break;
        }
        if (!intent.wantsConfirm) {
          botReply = `Should I look for a **${ctx.serviceType.replaceAll('_', ' ').toLowerCase()}**? Choose yes to continue or no to describe it again.`;
          metadata = { action: 'CONFIRM_SERVICE', serviceType: ctx.serviceType };
          break;
        }
        newState = 'NEED_LOCATION';
        await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState } });
        botReply = 'Great. Share your area or use current location so I can find nearby approved professionals.';
        metadata = { action: 'REQUEST_LOCATION' };
        break;
      }

      case 'NEED_LOCATION': {
        const { serviceType, description } = ctx;
        let lat = null, lon = null, address = userMessage;
        if (userMessage === 'Search again') { lat = ctx.userLat; lon = ctx.userLon; address = ctx.userAddress; }
        const coordMatch = userMessage.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lon = parseFloat(coordMatch[2]);
          address = userMessage.includes('|') ? userMessage.split('|').slice(1).join('|').trim() : userMessage;
        }
        if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          botReply = 'Select an address from the location search results below, or use current location, so I can find professionals near the correct map pin.';
          metadata = { action: 'REQUEST_LOCATION' };
          break;
        }
        const workers = (await matchingService.getNearbyWorkers(serviceType, lat, lon, 50)).filter(worker => worker.id !== ctx.excludedWorkerId);
        if (!workers.length) {
          newState = 'NEED_LOCATION';
          await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: { ...ctx, userLat: lat, userLon: lon, userAddress: address } } });
          botReply = replyService.noWorkerFound(serviceType);
          metadata = { action: 'RETRY_SEARCH' };
        } else {
          const candidates = workers.slice(0, 8).map(worker => ({ id: worker.id, name: worker.user.name, rating: worker.rating, reviewCount: worker._count?.ratingsReceived || 0, totalJobs: worker.totalJobs, bio: worker.bio, distance: worker.distance, serviceKey: worker.serviceKey || worker.serviceType, identityVerified: Boolean(worker.panVerified && worker.faceVerified) }));
          newState = 'CHOOSE_WORKER';
          await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: { ...ctx, userLat: lat, userLon: lon, userAddress: address, candidates } } });
          botReply = `I found ${candidates.length} approved professional${candidates.length === 1 ? '' : 's'}. View their profiles and customer reviews, then choose who receives your request. They can accept or decline.`;
          metadata = { action: 'CHOOSE_WORKER', workers: candidates };
        }
        await this.saveMessage(sessionId, 'bot', botReply, metadata);
        return { reply: botReply, state: newState, metadata };
      }

      case 'CHOOSE_WORKER': {
        const candidates = Array.isArray(ctx.candidates) ? ctx.candidates : [];
        if (intent.wantsReject) {
          newState = 'INIT';
          await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: {} } });
          botReply = 'Okay, I haven’t shared the issue. Tell me whenever you want to start again.';
          break;
        }
        const selected = candidates.find(candidate => userMessage === `SELECT_WORKER:${candidate.id}`);
        if (!selected) {
          botReply = 'View the profiles and reviews below, then select the professional you would like to request.';
          metadata = { action: 'CHOOSE_WORKER', workers: candidates };
          break;
        }
        const safetyNoticeAccepted = { version: SAFETY_NOTICE_VERSION, acceptedAt: new Date().toISOString() };
        const request = await requestService.createRequest({
          sessionId, userId, serviceType: ctx.serviceType, description: ctx.description,
          userLatitude: ctx.userLat, userLongitude: ctx.userLon, userAddress: ctx.userAddress,
        });
        await requestService.assignSpecificWorker(request.id, selected.id);
        newState = 'ASSIGNED';
        await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: { ...ctx, requestId: request.id, candidates, safetyNoticeAccepted } } });
        botReply = `Your request was sent to **${selected.name}**. Waiting for them to accept or decline. You can add photos, voice notes, or details here.`;
        metadata = { issueShared: true, requestId: request.id, requestStatus: 'ASSIGNED' };
        break;
      }

      case 'SEARCHING': {
        botReply = 'Your request is live. Add any useful details, photos, or voice notes below while nearby professionals review it.';
        metadata = { requestId: ctx.requestId, requestStatus: 'SEARCHING' };
        break;
      }

      case 'ASSIGNED': {
        botReply = "Your request has been assigned to a worker. Please wait for them to accept. You'll be notified shortly! 🔔";
        break;
      }

      case 'AWAITING_PRICE': {
        // Worker has set a price, waiting for user approval
        const requestId = session.request?.id || ctx.requestId;
        const proposedPrice = session.request?.proposedPrice ?? ctx.proposedPrice;
        if (!session.request || !['AWAITING_APPROVAL', 'PAYMENT_PENDING'].includes(session.request.status)) throw Object.assign(new Error('There is no price awaiting approval'), { status: 409 });
        if (intent.wantsConfirm) {
          newState = 'PAYMENT_PENDING';
          await this.updateOpenSession({ where: { id: sessionId }, data: { state: newState, context: { ...ctx, proposedPrice, requestId } } });
          await prisma.serviceRequest.update({
            where: { id: requestId },
            data: { userApproved: true, status: 'PAYMENT_PENDING', finalPrice: proposedPrice },
          });
          botReply = replyService.paymentPending(proposedPrice);
          metadata = { action: 'INITIATE_PAYMENT', requestId, amount: proposedPrice };
        } else if (intent.wantsReject) {
          botReply = `You’ve declined the price. Enter the amount you’d be comfortable paying, and I’ll send your counter-offer to the professional.`;
        } else {
          const counterOffer = Number(String(userMessage).replace(/[^0-9.]/g, ''));
          if (Number.isFinite(counterOffer) && counterOffer > 0 && counterOffer <= 1_000_000) {
            const request = await prisma.serviceRequest.update({ where: { id: requestId }, data: { counterPrice: counterOffer }, include: { worker: true } });
            const { sendNotification } = await import('./notification.service.js');
            await sendNotification(request.worker.userId, 'Customer sent a counter-offer', `The customer offered ₹${counterOffer.toLocaleString('en-IN')}. You can revise your price from the job screen.`, 'INFO', { requestId, counterOffer });
            botReply = `Your counter-offer of **₹${counterOffer.toLocaleString('en-IN')}** was sent. You’ll receive a notification when the professional responds.`;
          } else {
            botReply = `The professional proposed **₹${proposedPrice}**. Approve it, decline it, or enter a counter-offer amount.`;
            metadata = { action: 'PRICE_APPROVAL', requestId, proposedPrice };
          }
        }
        break;
      }

      case 'PAYMENT_PENDING': {
        botReply = `Your payment is pending. Please use the payment button to complete the transaction. 💳`;
        metadata = { action: 'SHOW_PAYMENT', requestId: ctx.requestId, amount: session.request?.finalPrice ?? ctx.proposedPrice };
        break;
      }

      case 'COMPLETED': {
        if (['REJECTED', 'CANCELLED'].includes(session.request?.status)) { botReply = 'This request is closed. Start a new chat to find a professional.'; break; }
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
            worker: { select: workerSelect },
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
      where: { userId, OR: [{ messages: { some: {} } }, { request: { isNot: null } }] },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        request: { select: { id: true, status: true, serviceType: true, serviceKey: true } },
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
