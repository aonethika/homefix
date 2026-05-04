'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { addBotMessage, updateChatState } from '@/store/chatSlice';
import { updateRequestStatus } from '@/store/requestSlice';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let globalSocket: Socket | null = null; // 🔥 important fix

export function useSocket(token: string | null, role?: string) {
  const dispatch = useDispatch();
  const mounted = useRef(false);

  useEffect(() => {
    if (!token) return;

    // revent StrictMode double run
    if (mounted.current) return;
    mounted.current = true;

    //  reuse global socket (prevents duplicates)
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'], 
        reconnection: true,
      });
    }

    const socket = globalSocket;

    socket.on('connect', () => {
      console.log('✅ Socket connected');

      if (role === 'WORKER') {
        socket.emit('join:worker');
      }
    });

    socket.on('connect_error', (err) => {
      console.log('❌ Socket error:', err.message);
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Socket disconnected');
    });

    // ===== EVENTS =====

    socket.on('request:accepted', ({ requestId, workerName }) => {
      dispatch(addBotMessage({
        content: `🎉 ${workerName} accepted your request!`,
        metadata: { requestId },
      }));
      dispatch(updateRequestStatus({ requestId, status: 'ACCEPTED' }));
      dispatch(updateChatState('ASSIGNED'));
    });

    socket.on('request:status', ({ requestId, status }) => {
      dispatch(updateRequestStatus({ requestId, status }));
    });

    socket.on('payment:completed', ({ requestId, amount }) => {
      dispatch(addBotMessage({
        content: `🎊 Paid ₹${amount}`,
        metadata: { requestId },
      }));
    });

    return () => {
      
      socket.off('connect');
      socket.off('request:accepted');
      socket.off('request:status');
      socket.off('payment:completed');
    };
  }, [token, role]);
}