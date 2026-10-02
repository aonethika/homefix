'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { Wrench } from 'lucide-react';

export default function Brand({ href = '/', compact = false, tone = 'dark' }: { href?: string; compact?: boolean; tone?: 'dark' | 'light' }) {
  const { user, token } = useSelector((state: RootState) => state.auth);
  const destination = href === '/' && token && user
    ? user.role === 'WORKER' ? '/worker' : user.role === 'ADMIN' ? '/admin' : '/chat'
    : href;
  return (
    <Link href={destination} className="group inline-flex items-center gap-2.5" aria-label="zoon home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-400 text-[#0b1020] shadow-[0_8px_28px_rgba(52,211,153,.24)] transition-transform group-hover:-rotate-6">
        <Wrench size={18} strokeWidth={2.5} />
      </span>
      {!compact && <span className={`font-display text-lg font-bold tracking-[-0.04em] ${tone === 'light' ? 'text-white' : 'text-[var(--text)]'}`}>zoon</span>}
    </Link>
  );
}
