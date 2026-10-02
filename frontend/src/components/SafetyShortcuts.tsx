'use client';
import { useState } from 'react';
import { Phone } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { safetyContacts } from '@/services/safety-contacts';

export default function SafetyShortcuts() {
  const [contact, setContact] = useState<(typeof safetyContacts)[number] | null>(null);
  return <><div aria-label="Safety call shortcuts" className="flex flex-wrap items-center gap-2">
    {safetyContacts.map(item => <button type="button" key={item.name} onClick={() => setContact(item)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--soft)]"><Phone size={14} />{item.name}</button>)}
  </div>{contact && <ConfirmDialog title={`Call ${contact.name}?`} confirmLabel="Call" onCancel={() => setContact(null)} onConfirm={() => { window.open(`tel:${contact.number}`, '_self'); setContact(null); }}><p className="text-lg font-bold text-[var(--text)]">{contact.number}</p><p>{contact.region}. This will open your phone dialer.</p></ConfirmDialog>}</>;
}
