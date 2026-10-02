'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowDown, CalendarDays, MessageCircle } from 'lucide-react';

type BookingMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  metadata?: { senderId?: string; senderName?: string; mediaType?: string; mediaData?: string; kind?: string; previousScheduledAt?: string; scheduledAt?: string };
};

export default function BookingMessageList({ messages, userId, customerName, professionalName, readOnly = false }: {
  messages: BookingMessage[];
  userId?: string;
  customerName?: string;
  professionalName?: string;
  readOnly?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousId = useRef<string>();
  const [unread, setUnread] = useState(false);
  const last = messages[messages.length - 1];
  const scrollToLatest = () => {
    const node = viewport.current;
    if (node) node.scrollTop = node.scrollHeight;
    nearBottom.current = true;
    setUnread(false);
  };
  useEffect(() => {
    if (!last || last.id === previousId.current) return;
    if (!previousId.current || nearBottom.current || (!readOnly && last.metadata?.senderId === userId)) scrollToLatest();
    else setUnread(true);
    previousId.current = last.id;
  }, [last?.id, userId, readOnly]);

  return <div className="relative min-h-0 flex-1">
    <div ref={viewport} role="log" aria-label="Booking messages" aria-live="polite" aria-relevant="additions" onScroll={() => {
      const node = viewport.current;
      if (!node) return;
      nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
      if (nearBottom.current) setUnread(false);
    }} onLoad={() => { if (nearBottom.current) scrollToLatest(); }} className="chat-scroll h-full overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
      {!messages.length ? <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--panel)] text-[var(--brand)]"><MessageCircle size={24} /></span>
        <h3 className="mt-4 text-base font-semibold">Your visit starts here</h3>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted)]">Discuss the issue, share a photo, or confirm access instructions. Booking updates will appear here too.</p>
      </div> : <div className="mx-auto max-w-3xl space-y-4">{messages.map((message, index) => {
        const own = !readOnly && (message.metadata?.senderId ? message.metadata.senderId === userId : false);
        const timestamp = new Date(message.createdAt);
        const newDay = index === 0 || timestamp.toDateString() !== new Date(messages[index - 1].createdAt).toDateString();
        return <Fragment key={message.id}>
          {newDay && <div className="flex items-center gap-4 py-2"><span className="h-px flex-1 bg-[var(--border)]" /><time dateTime={message.createdAt} className="text-[11px] font-medium text-[var(--muted)]">{timestamp.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</time><span className="h-px flex-1 bg-[var(--border)]" /></div>}
          {message.role === 'bot' ? <div className="mx-auto max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><CalendarDays size={14} />Booking update<time dateTime={message.createdAt} className="ml-auto text-[10px] font-normal">{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-[var(--text-secondary)]">{message.content}</p>
            {message.metadata?.kind === 'RESCHEDULE' && <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-2 text-xs leading-5 text-[var(--muted)]">
              {message.metadata.previousScheduledAt && <p>Previous: {new Date(message.metadata.previousScheduledAt).toLocaleString()}</p>}
              {message.metadata.scheduledAt && <p className="font-semibold text-[var(--text)]">Requested: {new Date(message.metadata.scheduledAt).toLocaleString()}</p>}
            </div>}
          </div> : <article className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
            <div className={`min-w-0 max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${own ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-[var(--border)] bg-[var(--panel)] text-[var(--text)]'}`}>
              <p className={`mb-1 text-[11px] font-semibold ${own ? 'text-blue-100' : 'text-[var(--muted)]'}`}>{own ? 'You' : message.metadata?.senderName || (message.role === 'worker' ? professionalName || 'Professional' : customerName || 'Homeowner')}</p>
              {message.content && <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}
              {message.metadata?.mediaType === 'IMAGE' && <a href={message.metadata.mediaData} target="_blank" rel="noreferrer" aria-label="Open attached photo"><img src={message.metadata.mediaData} alt="Photo shared in this booking" className="mt-2 max-h-64 max-w-full rounded-xl object-contain" /></a>}
              {message.metadata?.mediaType === 'AUDIO' && <audio controls preload="metadata" src={message.metadata.mediaData} className="mt-2 w-64 max-w-full" />}
              <time dateTime={message.createdAt} className={`mt-1.5 block text-right text-[10px] ${own ? 'text-blue-100' : 'text-[var(--muted)]'}`}>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          </article>}
        </Fragment>;
      })}</div>}
    </div>
    {unread && <button type="button" onClick={scrollToLatest} className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg"><ArrowDown size={14} />New messages</button>}
  </div>;
}
