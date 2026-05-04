'use client';

export default function TypingIndicator() {
  return (
    <div className="flex gap-2 justify-start">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center text-xs">
        🏠
      </div>

      <div className="bg-[#1f1f23] border border-[#2a2a30] rounded-xl px-3 py-2 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#a8a29e] animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#a8a29e] animate-bounce [animation-delay:0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#a8a29e] animate-bounce [animation-delay:0.3s]" />
      </div>
    </div>
  );
}