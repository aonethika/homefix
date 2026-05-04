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
    <div className="flex h-[100dvh] bg-[#0b0f0c] text-white overflow-hidden">

      {/* SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-[85%] sm:w-72 bg-[#101814]
        border-r border-green-900/30
        transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>

        <div className="p-4 border-b border-green-900/30 flex justify-between items-center">
          <div className="text-green-400 font-semibold">FixBot</div>

          <button
            onClick={handleNewChat}
            className="text-xs px-3 py-1 border border-green-700 rounded-md"
          >
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => handleLoadSession(s.id)}
              className={`w-full text-left px-3 py-3 rounded-md text-sm ${
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
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP */}
        <div className="flex items-center gap-3 px-3 py-3 border-b border-green-900/30 bg-[#0e1512]">

          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="font-semibold text-green-400 text-sm">
            FixBot
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
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

       
        {messages.length === 0 && (
          <div className="px-3 pb-2 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.text}
                  onClick={() => setInput(p.text)}
                  className="text-xs px-3 py-2 border border-green-900/40 rounded-md whitespace-nowrap"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="p-2 border-t border-green-900/30 flex gap-2 bg-[#0e1512]">

          <button
            onClick={() => {
              navigator.geolocation?.getCurrentPosition((pos) => {
                setInput(`${pos.coords.latitude},${pos.coords.longitude}`);
              });
            }}
            className="w-10 h-10 flex items-center justify-center border border-green-700 rounded-md"
          >
            <MapPin size={18} />
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type issue..."
            className="flex-1 bg-[#0b0f0c] border border-green-900/40 px-3 py-2 rounded-md text-sm"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-green-600 rounded-md text-sm"
          >
            Send
          </button>
        </div>
      </div>

      {/* MODALS */}
      {paymentData && <PaymentModal {...paymentData} onClose={() => setPaymentData(null)} />}
      {ratingData && <RatingModal {...ratingData} onClose={() => setRatingData(null)} />}
    </div>
  );
}