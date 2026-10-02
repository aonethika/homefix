'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ClipboardList } from 'lucide-react';
import Brand from '@/components/Brand';
import WorkspaceTools from '@/components/WorkspaceTools';
import ChatBox from '@/components/ChatBox';
import type { AppDispatch, RootState } from '@/store';

export default function ChatPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!token || !user) router.replace('/login');
    else if (user.role !== 'USER') router.replace(user.role === 'WORKER' ? '/worker' : '/admin');
  }, [router, token, user]);

  if (!token || !user || user.role !== 'USER') {
    return <div className="grid min-h-screen place-items-center bg-[var(--page)] text-sm text-[var(--muted)]">Opening your workspace…</div>;
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--page)]">
      <header className="z-20 flex min-h-[60px] shrink-0 items-center justify-between gap-2 py-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 backdrop-blur-xl sm:px-6">
        <div className="[&_a>span:last-child]:hidden sm:[&_a>span:last-child]:inline"><Brand href="/" /></div>
        <div className="flex items-center gap-1.5">
          <Link href="/dashboard" aria-label="My bookings" title="My bookings" className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--text)]">
            <ClipboardList size={17} /><span className="hidden sm:inline">Bookings</span>
          </Link>
          <WorkspaceTools logout={false} />
        </div>
      </header>
      <div className="min-h-0 flex-1"><ChatBox /></div>

    </main>
  );
}
