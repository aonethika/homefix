'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, X } from 'lucide-react';

export type zoonNotification = { title: string; message: string; tone?: 'info' | 'success' };

export function notify(detail: zoonNotification) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('zoon:notification', { detail }));
}

export default function NotificationToast() {
  const [items, setItems] = useState<(zoonNotification & { id: number })[]>([]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<zoonNotification>).detail;
      const id = Date.now() + Math.random();
      setItems(current => [...current.slice(-2), { ...detail, id }]);
      window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), 5000);
    };
    window.addEventListener('zoon:notification', listener);
    return () => window.removeEventListener('zoon:notification', listener);
  }, []);

  return (
    <div className="pointer-events-none fixed right-3 top-20 z-[100] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-20">
      {items.map(item => (
        <div key={item.id} role="status" className="pointer-events-auto flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-[var(--text)] shadow-[0_18px_50px_rgba(15,23,42,.16)] animate-slide-up">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.tone === 'success' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'}`}>
            {item.tone === 'success' ? <CheckCircle2 size={18} /> : <Bell size={18} />}
          </span>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{item.message}</p></div>
          <button onClick={() => setItems(current => current.filter(entry => entry.id !== item.id))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss notification"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
