import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return <div className="flex items-end gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-xl border border-[#D97757]/25 bg-[#D97757]/15 text-[#D97757]"><Bot size={16} /></span><div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/[.07] bg-white/[.055] px-4 py-3.5" aria-label="FixBot is responding">{[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D97757]" style={{ animationDelay: `${i * 130}ms` }} />)}</div></div>;
}
