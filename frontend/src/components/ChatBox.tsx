'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  sendMessage as sendMsgThunk,
  addBotMessage,
  createNewSession,
  loadSession,
  fetchSessions
} from '@/store/chatSlice';

import { RootState, AppDispatch } from '@/store';

import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import PaymentModal from './PaymentModal';
import RatingModal from './RatingModal';

import { useSocket } from '@/hooks/useSocket';
import { SERVICE_LABELS } from '@/utils/formatTime';

import { MapPin, Menu, X } from 'lucide-react';

const QUICK_PROMPTS = [
  { label: 'Pipe leak', text: 'My pipe is leaking in the bathroom' },
  { label: 'No power', text: 'There is no power in my living room' },
  { label: 'AC not cooling', text: 'My AC is not cooling properly' },
  { label: 'Door repair', text: 'My wooden door is broken and needs fixing' }
];

export default function ChatBox() {
  const dispatch = useDispatch<AppDispatch>();

  const { messages, sending, sessionId, sessions, currentRequest } =
    useSelector((s: RootState) => s.chat);

  const { user, token } = useSelector((s: RootState) => s.auth);

  const [input, setInput] = useState('');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [ratingData, setRatingData] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSocket(token, user?.role);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!user || !token) return;

    dispatch(fetchSessions());

    const saved = localStorage.getItem('sessionId');
    if (saved) dispatch(loadSession(saved));
  }, [user, token, dispatch]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    setInput('');

    dispatch(addBotMessage({ content: `__USER__${msg}`, metadata: null }));

    const res = await dispatch(
      sendMsgThunk({ message: msg, sessionId: sessionId || undefined })
    );

    if (sendMsgThunk.rejected.match(res)) {
      dispatch(addBotMessage({ content: 'Try again.', metadata: null }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAction = useCallback((action: string, data?: any) => {
    if (action === 'PAY') setPaymentData(data);
    if (action === 'RATE') setRatingData(data);
  }, []);

  const handleNewChat = async () => {
    const res = await dispatch(createNewSession());
    const id = (res as any)?.payload?.id;

    if (id) localStorage.setItem('sessionId', id);

    dispatch(addBotMessage({
      content: "Hi, I'm FixBot. Tell me your issue.",
      metadata: null
    }));

    setSidebarOpen(false);
  };

  const handleLoadSession = async (id: string) => {
    await dispatch(loadSession(id));
    localStorage.setItem('sessionId', id);
    setSidebarOpen(false);
  };

  const renderMessages = () => {
    const seen = new Set<string>();
    const list: any[] = [];

    for (const msg of messages) {
      const cleaned = msg.content.startsWith('__USER__')
        ? {
            ...msg,
            role: 'user',
            content: msg.content.replace('__USER__', '')
          }
        : msg;

      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        list.push(cleaned);
      }
    }

    return list;
  };

  return (
    <div className="flex h-full bg-[#0b0f0c] text-white">

      {/* SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-[#101814] border-r border-green-900/30
        transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-green-900/30 flex justify-between">
          <div className="text-green-400 font-semibold">FixBot</div>

          <button
            onClick={handleNewChat}
            className="text-xs px-3 py-1 border border-green-700 rounded-md hover:bg-green-900/20"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => handleLoadSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                sessionId === s.id
                  ? 'bg-green-900/30 border border-green-700'
                  : 'hover:bg-[#18251f]'
              }`}
            >
              {s.request?.serviceType
                ? SERVICE_LABELS[s.request.serviceType]
                : 'Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* MAIN */}
      <div className="flex-1 flex flex-col">

        {/* TOP BAR */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-green-900/30 bg-[#0e1512]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-green-400"
          >
            <Menu size={20} />
          </button>

          <div className="font-semibold text-green-400">
            FixBot Assistant
          </div>

          {currentRequest && (
            <div className="ml-auto text-xs text-green-300">
              {currentRequest.status}
            </div>
          )}
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {renderMessages().map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              metadata={msg.metadata}
              createdAt={msg.createdAt}
              onAction={handleAction}
            />
          ))}

          {sending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* QUICK START */}
        {messages.length === 0 && (
          <div className="px-4 pb-2 grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.text}
                onClick={() => setInput(p.text)}
                className="text-xs px-3 py-2 border border-green-900/40 rounded-md hover:bg-green-900/20"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* INPUT */}
        <div className="p-3 border-t border-green-900/30 flex gap-2 bg-[#0e1512]">

          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  const coords = `${pos.coords.latitude},${pos.coords.longitude}`;
                  setInput(coords);
                });
              }
            }}
            className="w-10 h-10 flex items-center justify-center border border-green-700 rounded-md hover:bg-green-900/20"
          >
            <MapPin size={18} />
          </button>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your issue..."
            className="flex-1 bg-[#0b0f0c] border border-green-900/40 px-3 py-2 rounded-md text-sm focus:outline-none focus:border-green-500"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-80 rounded-md text-sm"
          >
            Send
          </button>
        </div>
      </div>

      {/* MODALS */}
      {paymentData && (
        <PaymentModal
          requestId={paymentData.requestId}
          amount={paymentData.amount}
          onSuccess={() => setPaymentData(null)}
          onClose={() => setPaymentData(null)}
        />
      )}

      {ratingData && (
        <RatingModal
          requestId={ratingData.requestId}
          onSuccess={() => setRatingData(null)}
          onClose={() => setRatingData(null)}
        />
      )}
    </div>
  );
}