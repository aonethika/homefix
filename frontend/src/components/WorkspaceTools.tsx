'use client';

import { useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import NotificationInbox from './NotificationInbox';
import SupportButton from './SupportButton';
import ThemeToggle from './ThemeToggle';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import LogoutButton from './LogoutButton';

export default function WorkspaceTools({ notifications = true, support = true, mobileOnly = false, logout = true }: { notifications?: boolean; support?: boolean; mobileOnly?: boolean; logout?: boolean }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (!document.querySelector('dialog[open]') && event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, []);
  if (mobileOnly && !user) return null;
  return <div className={`flex shrink-0 items-center gap-1 ${mobileOnly ? 'sm:hidden' : ''}`}>
    <details ref={menu} className="relative">
      <summary aria-label="More options" title="More options" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--soft)] [&::-webkit-details-marker]:hidden"><MoreHorizontal size={20} /></summary>
      <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-lg">
        {support && <div className="mb-3"><SupportButton inline /></div>}
        <div className="flex items-center justify-between gap-4 text-sm text-[var(--muted)]"><span>Appearance</span><ThemeToggle inline /></div>
        {logout && <div className="mt-3 border-t border-[var(--border)] pt-2 sm:hidden"><LogoutButton className="w-full" /></div>}
      </div>
    </details>
    {notifications && <NotificationInbox inline />}
  </div>;
}
