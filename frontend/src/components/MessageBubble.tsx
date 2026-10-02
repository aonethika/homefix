'use client';

import { Bot, CreditCard, MapPin, Star, UserRound, Wrench } from 'lucide-react';
import { Fragment, ReactNode } from 'react';
import ProfessionalChoice from './ProfessionalChoice';
import { formatTime } from '@/utils/formatTime';

interface Props { role: 'user' | 'bot' | 'worker'; content: string; metadata?: any; createdAt: string; onAction?: (action: string, data?: any) => void; }

function inlineFormat(text: string): ReactNode[] {
  return text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function MessageBubble({ role, content, metadata, createdAt, onAction }: Props) {
  const isBot = role === 'bot';
  const isWorker = role === 'worker';
  const incoming = isBot || isWorker;
  const action = metadata?.action;
  const canPay = isBot && onAction && (action === 'INITIATE_PAYMENT' || action === 'SHOW_PAYMENT');

  return <div className={`flex items-end gap-2.5 ${incoming ? 'justify-start' : 'justify-end'}`}>
    {incoming && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-blue-300/15 bg-blue-300/10 text-[var(--brand)]">{isWorker ? <Wrench size={16} /> : <Bot size={16} />}</span>}
    <div className={`flex max-w-[86%] flex-col gap-1.5 sm:max-w-[72%] ${incoming ? 'items-start' : 'items-end'}`}>
      {metadata?.senderName && <span className="px-1 text-[10px] font-bold text-[var(--brand)]">{metadata.senderName}</span>}
      <div className={`prose-chat overflow-hidden rounded-2xl px-4 py-3 text-[13.5px] leading-6 shadow-sm ${incoming ? 'rounded-bl-md border border-[var(--border)] bg-[var(--panel)] text-[var(--text)]' : 'rounded-br-md bg-gradient-to-br from-blue-600 to-teal-500 font-medium text-white'}`}>
        {metadata?.mediaType === 'IMAGE' && metadata?.mediaData && <img src={metadata.mediaData} alt="Issue attachment" className="mb-2 max-h-72 w-full rounded-xl object-cover" />}
        {metadata?.mediaType === 'AUDIO' && metadata?.mediaData && <audio controls src={metadata.mediaData} className="mb-2 max-w-full" />}
        {content.split('\n').map((line, index) => <Fragment key={index}>{inlineFormat(line)}{index < content.split('\n').length - 1 && <br />}</Fragment>)}
      </div>
      {canPay && <button onClick={() => onAction('PAY', { requestId: metadata.requestId, amount: metadata.amount })} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-3.5 py-2 text-xs font-bold text-white"><CreditCard size={14} /> Pay now{metadata.amount ? ` · ₹${Number(metadata.amount).toFixed(0)}` : ''}</button>}
      {isBot && action === 'CONFIRM_SERVICE' && onAction && <div className="mt-2 flex gap-2"><button onClick={() => onAction('CONFIRM_SERVICE')} className="rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white">Yes, find one</button><button onClick={() => onAction('REJECT_SERVICE')} className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--muted)]">No, change it</button></div>}
      {isBot && ['CHOOSE_WORKER', 'SHARE_ISSUE'].includes(action) && onAction && <div className="mt-2 grid w-full gap-3">{(metadata.workers || []).map((worker: any) => <ProfessionalChoice key={worker.id} worker={worker} onSelect={() => onAction('SELECT_WORKER', worker)} />)}</div>}
      {isBot && action === 'RETRY_SEARCH' && onAction && <button onClick={() => onAction('RETRY_SEARCH')} className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">Search again</button>}
      {isBot && action === 'PRICE_APPROVAL' && onAction && <div className="mt-2 flex gap-2"><button onClick={() => onAction('APPROVE_PRICE')} className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-emerald-950">Approve price</button><button onClick={() => onAction('REJECT_PRICE')} className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3.5 py-2 text-xs font-bold text-[var(--danger)]">Decline</button></div>}
      {isBot && action === 'SHOW_RATING' && onAction && <button onClick={() => onAction('RATE', { requestId: metadata.requestId })} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3.5 py-2 text-xs font-bold text-[#241a02]"><Star size={14} /> Rate service</button>}
      <span className="px-1 text-[10px] text-[var(--muted)]">{formatTime(createdAt)}</span>
    </div>
    {!incoming && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--soft)] text-[var(--muted)]"><UserRound size={15} /></span>}
  </div>;
}
