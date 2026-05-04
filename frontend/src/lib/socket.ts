import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      auth: { token: token || (typeof window !== 'undefined' ? localStorage.getItem('homefix_token') : '') },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
