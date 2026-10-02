import { chatLifecycle } from '../services/chat-lifecycle.service.js';
import { ChatService } from '../services/chat.service.js';

const chatService = new ChatService();

export const sendMessage = async (req, res, next) => {
  try {
    const { message, sessionId, safetyAcknowledged } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    let activeSessionId = sessionId;

    if (!activeSessionId) {
      const session = await chatService.getOrCreateSession(req.user.id);
      activeSessionId = session.id;
    }

    const result = await chatService.processMessage(activeSessionId, req.user.id, message, { safetyAcknowledged: safetyAcknowledged === true });
    res.json({ success: true, data: { ...result, sessionId: activeSessionId } });
  } catch (err) {
    next(err);
  }
};

export const createSession = async (req, res, next) => {
  try {
    const session = await chatService.createSession(req.user.id);
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await chatService.getSessionMessages(req.params.sessionId, req.user.id);
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

export const getUserSessions = async (req, res, next) => {
  try {
    const sessions = await chatService.getUserSessions(req.user.id);
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
};

export const stopSession = async (req, res, next) => {
  try { res.json({ success: true, data: await chatLifecycle.stop({ userId: req.user.id, sessionId: req.params.sessionId, expectedStatus: req.body.expectedStatus, pendingOnly: true }) }); }
  catch (error) { next(error); }
};

export const restartSession = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await chatService.restartSession(req.params.sessionId, req.user.id) }); }
  catch (error) { next(error); }
};
