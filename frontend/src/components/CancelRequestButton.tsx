'use client';
import { useState } from 'react';
import { requestAPI, getApiError } from '@/services/api';
import ConfirmDialog from './ConfirmDialog';

export default function CancelRequestButton({ request, onCancelled, onChanged }: { request: any; onCancelled: () => void | Promise<void>; onChanged?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!['PENDING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED'].includes(request.status)) return null;
  return <><button type="button" onClick={() => { setError(''); setOpen(true); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--soft)]">Cancel request</button>{open && <ConfirmDialog title="Cancel this request?" confirmLabel="Cancel request" busy={busy} error={error} onCancel={() => setOpen(false)} onConfirm={async () => {
    if (busy) return; setBusy(true); setError('');
    try { await requestAPI.cancelRequest(request.id, request.status); await onCancelled(); setOpen(false); }
    catch (error) { setError(getApiError(error, 'This request changed. Refresh and try again.')); await onChanged?.(); }
    finally { setBusy(false); }
  }}><p>Both people can cancel until the professional starts work. This closes the request and keeps the conversation in your history.</p></ConfirmDialog>}</>;
}
