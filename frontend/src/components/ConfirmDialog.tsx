'use client';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, busy = false, error }: {
  title: string; children?: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { ref.current?.close(); previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} onClick={event => { if (event.target === ref.current && !busy) onCancel(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--text)] shadow-xl backdrop:bg-slate-950/50">
    <h2 id={titleId} className="text-lg font-bold">{title}</h2>
    {children && <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{children}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button autoFocus type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Please wait...' : confirmLabel}</button></div>
  </dialog>, document.body);
}
