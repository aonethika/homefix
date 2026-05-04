'use client';
import { formatTime } from '@/utils/formatTime';

interface Props {
  role: 'user' | 'bot';
  content: string;
  metadata?: any;
  createdAt: string;
  onAction?: (action: string, data?: any) => void;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}

export default function MessageBubble({ role, content, metadata, createdAt, onAction }: Props) {
  const isBot = role === 'bot';

  return (
    <div className={`flex gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}>
      
      {isBot && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center text-xs">
          🏠
        </div>
      )}

      <div className={`max-w-[85%] ${isBot ? 'items-start' : 'items-end'} flex flex-col gap-1`}>
        
        <div
          className={`rounded-xl px-3 py-2 text-[13px] leading-snug ${
            isBot
              ? 'bg-[#1f1f23] border border-[#2a2a30] text-[#e7e5e4]'
              : 'bg-gradient-to-br from-[#418e4d] to-[#357a41] text-white'
          }`}
        >
          <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        </div>

        {isBot && metadata?.action === 'INITIATE_PAYMENT' && onAction && (
          <button
            onClick={() => onAction('PAY', { requestId: metadata.requestId, amount: metadata.amount })}
            className="mt-1 px-3 py-1.5 bg-[#418e4d] text-white text-[11px] rounded-lg"
          >
            💳 Pay ₹{metadata.amount?.toFixed(0)}
          </button>
        )}

        {isBot && metadata?.action === 'SHOW_PAYMENT' && onAction && (
          <button
            onClick={() => onAction('PAY', { requestId: metadata.requestId, amount: metadata.amount })}
            className="mt-1 px-3 py-1.5 bg-[#418e4d] text-white text-[11px] rounded-lg"
          >
            💳 Complete Payment
          </button>
        )}

        {isBot && metadata?.action === 'SHOW_RATING' && onAction && (
          <button
            onClick={() => onAction('RATE', { requestId: metadata.requestId })}
            className="mt-1 px-3 py-1.5 bg-yellow-500 text-black text-[11px] rounded-lg"
          >
            ⭐ Rate
          </button>
        )}

        <span className="text-[9px] text-[#57534e] px-1">
          {formatTime(createdAt)}
        </span>
      </div>

      {!isBot && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2a2a30] border border-[#3a3a40] flex items-center justify-center text-[10px] text-[#a8a29e]">
          U
        </div>
      )}
    </div>
  );
}