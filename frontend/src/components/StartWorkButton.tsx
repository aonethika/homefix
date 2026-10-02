'use client';
import { useState } from 'react';
import { workerAPI, getApiError } from '@/services/api';
import ConfirmDialog from './ConfirmDialog';
export default function StartWorkButton({ request, onStarted }: { request: any; onStarted: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (request.status !== 'ACCEPTED' || request.bookingStage === 'READY') return null;
  const early = request.scheduledAt && new Date(request.scheduledAt) > new Date();
  return <><button disabled={Boolean(early)} onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{early ? 'Start at appointment time' : 'Start work'}</button>{open && <ConfirmDialog title="Have you arrived and are you ready to start?" confirmLabel="Start work" busy={busy} error={error} onCancel={() => setOpen(false)} onConfirm={async () => { if (busy) return; setBusy(true); try { await workerAPI.updateStatus(request.id, 'IN_PROGRESS'); await onStarted(); setOpen(false); } catch (error) { setError(getApiError(error, 'This job changed. Refresh and try again.')); await onStarted(); } finally { setBusy(false); } }}><p>Confirm that you are at the service location and have agreed on the work with the customer. Cancellation is no longer available once work starts.</p></ConfirmDialog>}</>;
}
