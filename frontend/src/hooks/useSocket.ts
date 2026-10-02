'use client';

import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { loadSession, addBotMessage, addChatMessage, setCurrentWorker, updateChatState, updateCurrentRequestStatus } from '@/store/chatSlice';
import { fetchUserRequests, fetchWorkerRequests, updateRequestStatus } from '@/store/requestSlice';
import { notify } from '@/components/NotificationToast';
import { store, type AppDispatch } from '@/store';
import { fetchProfile } from '@/store/authSlice';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
let globalSocket: Socket | null = null;
let socketToken: string | null = null;

export function useSocket(token: string | null, role?: string) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!token) {
      globalSocket?.disconnect();
      globalSocket = null;
      socketToken = null;
      return;
    }

    if (!globalSocket || socketToken !== token) {
      globalSocket?.disconnect();
      socketToken = token;
      globalSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
    }

    const socket = globalSocket;
    const joinRoleRoom = () => {
      if (role === 'WORKER') { socket.emit('join:worker'); dispatch(fetchWorkerRequests()); }
      const sessionId = store.getState().chat.sessionId;
      if (role === 'USER' && sessionId) dispatch(loadSession(sessionId));
    };
    const onAssigned = ({ serviceType }: any) => {
      notify({ title: 'New service request', message: `A ${String(serviceType).replaceAll('_', ' ').toLowerCase()} job is ready for review.` });
      dispatch(fetchWorkerRequests());
    };
    const onAccepted = ({ requestId, workerName }: any) => {
      if (store.getState().chat.currentRequest?.id !== requestId || store.getState().chat.stopping || ['CANCELLED', 'REJECTED'].includes(store.getState().chat.currentRequest?.status)) return;
      const sessionId = store.getState().chat.sessionId;
      if (sessionId) dispatch(loadSession(sessionId));
      dispatch(fetchUserRequests());
    };
    const onRejected = ({ requestId, message, workers }: any) => {
      if (store.getState().chat.currentRequest?.id !== requestId || store.getState().chat.stopping || ['CANCELLED', 'REJECTED'].includes(store.getState().chat.currentRequest?.status)) return;
      const canChooseAgain = Array.isArray(workers) && workers.length > 0;
      dispatch(updateRequestStatus({ requestId, status: canChooseAgain ? 'PENDING' : 'REJECTED' }));
      dispatch(updateCurrentRequestStatus({ requestId, status: canChooseAgain ? 'PENDING' : 'REJECTED' }));
      dispatch(updateChatState(canChooseAgain ? 'CHOOSE_WORKER' : 'COMPLETED'));
      dispatch(addBotMessage({ content: message || 'That professional was unavailable. Please try another match.', metadata: canChooseAgain ? { action: 'CHOOSE_WORKER', workers, requestId } : { requestId } }));
      notify({ title: 'Request update', message: 'The professional could not take this job.' });
    };
    const onStatus = ({ requestId, status }: any) => {
      const current = store.getState().chat.currentRequest;
      if (current?.id === requestId && ['CANCELLED', 'REJECTED'].includes(current.status)) return;
      dispatch(updateRequestStatus({ requestId, status }));
      dispatch(updateCurrentRequestStatus({ requestId, status }));
      if (role === 'WORKER') dispatch(fetchWorkerRequests());
      if (role === 'USER') {
        dispatch(fetchUserRequests());
        if (store.getState().chat.currentRequest?.id === requestId && ['IN_PROGRESS','COMPLETED'].includes(status)) dispatch(addBotMessage({ content: status === 'IN_PROGRESS' ? 'Your professional has started the work.' : 'Your professional marked the work complete. Review the final price when they send it.', metadata: { requestId, kind: 'STATUS' } }));
      }
      notify({ title: 'Service updated', message: `Your booking is now ${String(status).replaceAll('_', ' ').toLowerCase()}.`, tone: status === 'COMPLETED' ? 'success' : 'info' });
    };
    const onPrice = ({ requestId, price, workerName }: any) => {
      if (store.getState().chat.currentRequest?.id !== requestId || store.getState().chat.stopping || ['CANCELLED', 'REJECTED'].includes(store.getState().chat.currentRequest?.status)) return;
      dispatch(updateChatState('AWAITING_PRICE'));
      dispatch(updateRequestStatus({ requestId, status: 'AWAITING_APPROVAL' }));
      dispatch(updateCurrentRequestStatus({ requestId, status: 'AWAITING_APPROVAL' }));
      dispatch(addBotMessage({ content: `${workerName} proposed **₹${Number(price).toLocaleString('en-IN')}** for the completed work. Reply **Yes** to approve and continue to payment.`, metadata: { action: 'PRICE_APPROVAL', requestId, proposedPrice: price } }));
      notify({ title: 'Price ready for approval', message: `${workerName} proposed ₹${Number(price).toLocaleString('en-IN')}.` });
    };
    const onPaid = ({ requestId, amount }: any) => {
      if (role === 'WORKER') { dispatch(fetchWorkerRequests()); return; }
      if (store.getState().chat.currentRequest?.id !== requestId) { dispatch(fetchUserRequests()); return; }
      dispatch(updateRequestStatus({ requestId, status: 'PAID' }));
      dispatch(updateCurrentRequestStatus({ requestId, status: 'PAID' }));
      dispatch(addBotMessage({ content: `Payment of **₹${Number(amount).toLocaleString('en-IN')}** was confirmed. Thank you!`, metadata: { action: 'SHOW_RATING', requestId } }));
      role === 'WORKER' ? dispatch(fetchWorkerRequests()) : dispatch(fetchUserRequests());
      notify({ title: 'Payment confirmed', message: `₹${Number(amount).toLocaleString('en-IN')} was paid successfully.`, tone: 'success' });
    };
    const onAdminUpdate = ({ status }: any) => {
      window.dispatchEvent(new Event('Zoon:data-changed'));
      notify({ title: 'Platform activity', message: `A service request is now ${String(status).replaceAll('_', ' ').toLowerCase()}.` });
    };
    const onNotification = (item: any) => {
      notify({ title: item.title || 'Zoon update', message: item.message || 'There is a new update.', tone: item.type === 'SUCCESS' || item.type === 'APPROVED' ? 'success' : 'info' });
      window.dispatchEvent(new Event('Zoon:data-changed'));
      if (role === 'WORKER') {
        dispatch(fetchProfile());
        dispatch(fetchWorkerRequests());
      }
    };
    const onWorkerLocation = (location: any) => window.dispatchEvent(new CustomEvent('Zoon:worker-location', { detail: location }));
    const onMessage = ({ requestId, message }: any) => {
      if (role === 'USER' && store.getState().chat.currentRequest?.id !== requestId) return;
      if (role === 'USER') dispatch(addChatMessage(message));
      if (role === 'WORKER') dispatch(fetchWorkerRequests());
    };
    const onClaimed = () => dispatch(fetchWorkerRequests());

    socket.on('connect', joinRoleRoom);
    socket.on('request:assigned', onAssigned);
    socket.on('request:accepted', onAccepted);
    socket.on('request:rejected', onRejected);
    socket.on('request:status', onStatus);
    socket.on('request:price-set', onPrice);
    socket.on('payment:completed', onPaid);
    socket.on('admin:request-updated', onAdminUpdate);
    socket.on('notification:new', onNotification);
    socket.on('worker:location:update', onWorkerLocation);
    socket.on('request:message', onMessage);
    socket.on('request:claimed', onClaimed);
    if (socket.connected) joinRoleRoom();

    return () => {
      socket.off('connect', joinRoleRoom);
      socket.off('request:assigned', onAssigned);
      socket.off('request:accepted', onAccepted);
      socket.off('request:rejected', onRejected);
      socket.off('request:status', onStatus);
      socket.off('request:price-set', onPrice);
      socket.off('payment:completed', onPaid);
      socket.off('admin:request-updated', onAdminUpdate);
      socket.off('notification:new', onNotification);
      socket.off('worker:location:update', onWorkerLocation);
      socket.off('request:message', onMessage);
      socket.off('request:claimed', onClaimed);
    };
  }, [dispatch, role, token]);
}

export function emitWorkerLocation(latitude: number, longitude: number, accuracy?: number) {
  globalSocket?.emit('worker:location', { lat: latitude, lon: longitude, accuracy });
}

export function disconnectSocket() {
  globalSocket?.disconnect(); globalSocket = null; socketToken = null;
}
