'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, Lock } from 'lucide-react';

export default function HomeSafetyNotice({
  checked,
  onChange,
  error,
  blockedMessage,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  error?: string;
  blockedMessage?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (checked && !expanded && !blockedMessage && !error) {
    return <aside className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-xs" aria-label="Home service safety notice">
      <ShieldCheck size={17} className="shrink-0 text-emerald-600" />
      <span className="flex-1 font-semibold">Safety notes accepted</span>
      <button type="button" onClick={() => setExpanded(true)} className="font-semibold text-[var(--brand)] underline underline-offset-4">Review</button>
    </aside>;
  }
  return (
    <aside className="hf-safety rounded-2xl border p-4" aria-label="Home service safety notice">
      <div className="flex items-start gap-2">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />
        <div className="min-w-0">
          <p className="text-sm font-bold">Before your home visit</p>
          {checked && <button type="button" onClick={() => setExpanded(false)} className="mt-1 text-xs font-semibold text-[var(--brand)] underline">Hide details</button>}
          <p className="mt-1 text-xs leading-5">
            Zoon connects you with an independent professional; the professional is responsible for their
            conduct and work. We cannot guarantee work quality or conduct, and this notice does not limit any
            rights you have under applicable law.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5">
            <li>Confirm the professional’s name and agree on the job scope and price in the app.</li>
            <li>Never share OTPs, passwords, UPI PINs, or bank login details.</li>
            <li>Keep children, pets, and valuables safe; do not proceed if you feel uncomfortable.</li>
            <li>Report concerns through Zoon support. For immediate danger in India, call 112.</li>
          </ul>

          {blockedMessage ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-800">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>
                {blockedMessage}{' '}
                <a href="/dashboard" className="underline underline-offset-2">
                  View my bookings
                </a>
              </span>
            </div>
          ) : (
            onChange && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-[var(--border)] pt-3 text-xs font-semibold leading-5">
                <input
                  type="checkbox"
                  className="mt-1 shrink-0 accent-blue-600"
                  checked={!!checked}
                  onChange={event => onChange(event.target.checked)}
                />
                <span>I have read these safety notes and understand I am requesting service from an independent professional.</span>
              </label>
            )
          )}

          {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
        </div>
      </div>
    </aside>
  );
}
