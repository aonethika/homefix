'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { ArrowLeft, CalendarDays, Clock3, MapPin, MessageCircle, Send, CheckCircle2, Paperclip, X, Info, Loader2 } from 'lucide-react';
import { RootState } from '@/store';
import BookingMessageList from '@/components/BookingMessageList';
import CancelRequestButton from '@/components/CancelRequestButton';
import StartWorkButton from '@/components/StartWorkButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import SafetyShortcuts from '@/components/SafetyShortcuts';
import WorkspaceTools from '@/components/WorkspaceTools';
import BookingAttachments, { BookingAttachment } from '@/components/BookingAttachments';
import { requestAPI, workerAPI, getApiError } from '@/services/api';
const labels: Record<string, string> = { REQUESTED: 'Awaiting confirmation', READY: 'Choose your visit time', SCHEDULED: 'Visit confirmed', DECLINED: 'Request declined', CANCELLED: 'Booking cancelled', EXPIRED: 'Request expired' };
const localInput = (value: string) => { const date = new Date(value); return new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export default function BookingPage({ params }: { params: { id: string } }) {
  const user = useSelector((s: RootState) => s.auth.user);
  const router = useRouter();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [attachments, setAttachments] = useState<BookingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'conversation' | 'details'>('conversation');
  useEffect(() => {
    const wantsAdmin = new URLSearchParams(window.location.search).get('admin') === '1';
    if (wantsAdmin && !localStorage.getItem('Zoon_admin_token')) { router.replace('/admin'); return; }
    if (!wantsAdmin && !user) { router.replace(`/login?next=${encodeURIComponent(`/bookings/${params.id}`)}`); return; }
    setAdmin(wantsAdmin);
  }, [user, params.id, router]);
  const refresh = useCallback(async () => { if (admin === null) return; const r = await requestAPI.details(params.id, admin); setRequest(r.data.data); }, [params.id, admin]);
  useEffect(() => { if (admin === null) return; const load = () => refresh().catch(e => setError(getApiError(e, 'Could not open this booking.'))); load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, [refresh, admin]);
  const act = async (action: () => Promise<any>) => { if (busy) return; setBusy(true); setError(''); try { await action(); await refresh(); } catch (e) { setError(getApiError(e, 'Could not save this change. Please try again.')); } finally { setBusy(false); } };
  const owner = !admin && user?.id === request?.userId;
  const worker = !admin && user?.role === 'WORKER' && request?.worker?.userId === user.id;
  const closed = request && ['REJECTED', 'CANCELLED', 'PAID'].includes(request.status);
  const editable = request && ['ASSIGNED', 'ACCEPTED'].includes(request.status);
  const status = request && (['ASSIGNED', 'ACCEPTED', 'CANCELLED', 'REJECTED'].includes(request.status) ? labels[request.bookingStage] || request.status.replaceAll('_', ' ') : request.status.replaceAll('_', ' '));
  const counterpart = worker ? request?.user?.name : request?.worker?.user?.name;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const send = () => { if (busy || recording || (!text.trim() && !attachments.length)) return; return act(async () => { if (text.trim()) { await requestAPI.sendMessage(params.id, { content: text }); setText(''); } for (const attachment of attachments) { await requestAPI.sendMessage(params.id, attachment); setAttachments(current => current.filter(item => item !== attachment)); } setMediaOpen(false); }); };
  const nextStep = closed ? 'This booking is closed. You can still read your conversation.'
    : request?.bookingStage === 'REQUESTED' ? worker ? 'Review the requested visit and accept or decline in Details.' : 'Waiting for the professional to confirm. You can message them here.'
    : request?.bookingStage === 'READY' ? owner ? 'Your professional accepted. Choose your visit time in Details.' : 'Waiting for the homeowner to choose a visit time.'
    : request?.bookingStage === 'SCHEDULED' ? 'Your visit is confirmed. Use this conversation to prepare for the appointment.'
    : 'Keep your job updates and agreements together here.';

  return <main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--page)] text-[var(--text)]">
    <nav className="relative z-30 flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3 sm:px-6">
      <Link href={admin ? '/admin' : user?.role === 'WORKER' ? '/worker' : '/dashboard'} className="inline-flex min-h-10 items-center gap-2 rounded-xl text-sm font-semibold text-[var(--muted)] hover:text-[var(--brand)]"><ArrowLeft size={18} />{admin ? 'Admin appointments' : user?.role === 'WORKER' ? 'Professional workspace' : 'My bookings'}</Link>
      <WorkspaceTools notifications={!admin} support={!admin} />
    </nav>
    {error && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-400/30 bg-rose-500/5 px-4 py-3 text-sm text-[var(--danger)]"><p>{error}</p><button type="button" className="shrink-0 font-semibold underline" onClick={() => { setError(''); refresh().catch(e => setError(getApiError(e, 'Could not open this booking.'))); }}>Retry</button></div>}
    {!request ? <div className="grid min-h-0 flex-1 place-items-center p-6"><p role="status" className="flex items-center gap-2 text-sm text-[var(--muted)]">{!error && <Loader2 size={18} className="animate-spin" />}{error ? 'Unable to load this booking. Please try again.' : 'Loading your booking...'}</p></div> : <>
      <header className="mx-auto flex w-full max-w-7xl shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0"><p className="hidden text-[10px] font-bold uppercase tracking-widest sm:block text-[var(--brand)]">{admin ? 'Appointment review' : worker ? 'Customer appointment' : 'Your appointment'}</p><h1 className="mt-1 text-xl font-bold capitalize tracking-tight">{String(request.serviceKey || request.serviceType || 'Home service').replaceAll('_', ' ').toLowerCase()}</h1></div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${closed ? 'border-[var(--border)] text-[var(--muted)]' : request.status === 'ASSIGNED' ? 'border-amber-500/25 bg-amber-500/5 text-[var(--warning)]' : 'border-teal-500/25 bg-teal-500/5 text-[var(--success)]'}`}>{closed ? <Info size={14} /> : request.status === 'ASSIGNED' ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}{request.bookingStage === 'READY' && worker ? 'Awaiting visit time' : status}</span>
      </header>
      <div className="mx-4 mb-3 grid shrink-0 grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--soft)] p-1 lg:hidden" aria-label="Booking view">
        <button type="button" aria-pressed={mobilePanel === 'conversation'} onClick={() => setMobilePanel('conversation')} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${mobilePanel === 'conversation' ? 'bg-[var(--panel)] text-[var(--brand)] shadow-sm' : 'text-[var(--muted)]'}`}><MessageCircle size={16} />Messages</button>
        <button type="button" aria-pressed={mobilePanel === 'details'} onClick={() => setMobilePanel('details')} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${mobilePanel === 'details' ? 'bg-[var(--panel)] text-[var(--brand)] shadow-sm' : 'text-[var(--muted)]'}`}><CalendarDays size={16} />Details{((worker && request.bookingStage === 'REQUESTED') || (owner && request.bookingStage === 'READY')) && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Action needed" />}</button>
      </div>
      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-5 px-3 pb-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Conversation" className={`${mobilePanel === 'conversation' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm lg:flex`}>
          <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-500/10 text-base font-bold text-[var(--brand)]">{String(counterpart || 'H').slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0"><h2 className="truncate text-sm font-bold">{admin ? `${request.user?.name || 'Homeowner'} & ${counterpart || 'Professional'}` : counterpart || (worker ? 'Homeowner' : 'Your professional')}</h2><p className="mt-0.5 text-xs text-[var(--muted)]">{admin ? 'Read-only conversation' : worker ? 'Homeowner' : 'Service professional'}</p></div>
          </div>
          <div className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] bg-[var(--soft)] px-4 py-2.5 text-xs leading-5 text-[var(--muted)]"><Info size={15} className="mt-0.5 shrink-0" /><p className="flex-1">{nextStep}</p><button type="button" onClick={() => setMobilePanel('details')} className="shrink-0 font-semibold text-[var(--brand)] lg:hidden">Details</button></div>
          {!admin && !closed && request.worker && <div className="shrink-0 border-b border-[var(--border)] px-4 py-2"><SafetyShortcuts /></div>}
          <div className="flex min-h-0 flex-1 flex-col bg-[var(--page)]"><BookingMessageList key={params.id} messages={request.session?.messages || []} userId={user?.id} customerName={request.user?.name} professionalName={request.worker?.user?.name} readOnly={Boolean(admin)} /></div>
          {((owner && request.status === 'ASSIGNED') || ((owner || worker) && request.status === 'ACCEPTED')) && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2"><Link href={`/tracking/${request.id}`} className="min-h-11 content-center text-sm font-semibold text-[var(--brand)]">Track visit</Link><CancelRequestButton request={request} onCancelled={refresh} onChanged={refresh} /></div>}

          {owner && ['CANCELLED', 'REJECTED'].includes(request.status) && <Link href="/workers" className="shrink-0 border-t border-[var(--border)] p-4 text-center text-sm font-semibold text-[var(--brand)]">Find another professional</Link>}
          {!admin && !closed ? <form className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)] p-3 sm:p-4" onSubmit={e => { e.preventDefault(); send(); }}>
            <div className={mediaOpen ? 'mb-3 max-h-[25dvh] overflow-y-auto rounded-xl bg-[var(--soft)] p-3' : 'hidden'}>
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold">Photos and voice notes</p><button type="button" disabled={recording} onClick={() => setMediaOpen(false)} aria-label="Close attachments" className="rounded-lg p-1 disabled:opacity-40"><X size={16} /></button></div>
              <BookingAttachments value={attachments} onChange={setAttachments} disabled={busy} onRecordingChange={setRecording} />
            </div>
            <label className="sr-only" htmlFor="booking-message">Message your {worker ? 'customer' : 'professional'}</label>
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--page)] p-2 focus-within:border-[var(--brand)]">
              <button type="button" disabled={busy || recording} aria-label="Attach photos or voice notes" aria-expanded={mediaOpen} onClick={() => setMediaOpen(!mediaOpen)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl disabled:opacity-40 ${mediaOpen ? 'bg-blue-500/10 text-[var(--brand)]' : 'text-[var(--muted)] hover:bg-[var(--soft)]'}`}><Paperclip size={19} /></button>
              <textarea id="booking-message" disabled={busy} maxLength={2000} rows={2} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={`Message your ${worker ? 'customer' : 'professional'}...`} className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-5 outline-none placeholder:text-[var(--muted)] disabled:opacity-60" />
              <button disabled={busy || recording || (!text.trim() && !attachments.length)} aria-label={busy ? 'Sending message' : 'Send message'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40">{busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]"><span>{recording ? 'Finish recording before sending.' : attachments.length ? `${attachments.length} attachment(s) ready to send` : 'Keep visit details and agreements here.'}</span><span className="hidden sm:inline">Enter to send ? Shift + Enter for a new line</span></div>
          </form> : <p className="shrink-0 border-t border-[var(--border)] p-4 text-center text-xs text-[var(--muted)]">{admin ? 'Read-only conversation for admin review.' : 'This booking is closed. Your messages remain available here.'}</p>}
        </section>
        <aside aria-label="Visit details and booking actions" className={`${mobilePanel === 'details' ? 'block' : 'hidden'} chat-scroll min-h-0 space-y-4 overflow-y-auto overscroll-contain pb-2 lg:block`}>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"><h2 className="flex items-center gap-2 font-bold"><CalendarDays size={18} className="text-[var(--brand)]"/>Visit details</h2>
              {request.scheduledAt && <div className="my-4 rounded-xl bg-[var(--soft)] p-4"><p className="font-bold">{new Date(request.scheduledAt).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long' })}</p><p className="mt-1 text-2xl font-bold tracking-tight">{new Date(request.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p><p className="mt-2 text-xs text-[var(--muted)]">{timezone} · One-hour arrival slot</p><p className="mt-3 text-xs leading-5 text-[var(--muted)]">{closed ? 'This appointment is closed.' : request.status === 'ASSIGNED' ? 'Requested time. Waiting for professional confirmation.' : 'Confirmed. Reminders appear in your notification bell.'}</p></div>}
              {owner && editable && request.scheduledAt && !changeOpen && <button className="disabled:opacity-50 w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--brand)]" onClick={() => { setDate(localInput(request.scheduledAt)); setChangeOpen(true); }}>Change date or time</button>}
              {owner && editable && (changeOpen || request.bookingStage === 'READY') && <form className="my-4 space-y-3" onSubmit={e => { e.preventDefault(); act(async () => { if (request.scheduledAt) await requestAPI.reschedule(params.id, new Date(date).toISOString()); else await requestAPI.schedule(params.id, new Date(date).toISOString()); setChangeOpen(false); }); }}><label className="block text-sm font-semibold">{request.scheduledAt ? 'New date and time' : 'Choose your visit time'}<input required type="datetime-local" min={localInput(new Date(Date.now() + 15 * 60000).toISOString())} max={localInput(new Date(Date.now() + 180 * 86400000).toISOString())} className="hf-input mt-2" value={date} onChange={e => setDate(e.target.value)}/></label><p className="text-xs leading-5 text-[var(--muted)]">Choose at least 15 minutes ahead, within 180 days. Changing the time releases the previous slot and asks the professional to confirm again.</p><button disabled={busy} className="disabled:cursor-not-allowed disabled:opacity-50 hf-primary w-full px-4 py-3 text-sm">{busy ? 'Saving...' : request.scheduledAt ? 'Request new time' : 'Confirm visit time'}</button>{request.scheduledAt && <button type="button" className="w-full text-sm text-[var(--muted)]" onClick={() => setChangeOpen(false)}>Keep current time</button>}</form>}
              {worker && request.bookingStage === 'REQUESTED' && !closed && <div className="space-y-2"><button disabled={busy} className="disabled:cursor-not-allowed disabled:opacity-50 hf-primary w-full px-4 py-3 text-sm" onClick={() => act(() => workerAPI.acceptRequest(params.id))}>Accept this visit</button><button disabled={busy} className="disabled:opacity-50 w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm" onClick={() => act(() => workerAPI.rejectRequest(params.id))}>Decline request</button><p className="text-xs leading-5 text-[var(--muted)]">Need another time? Message the homeowner and ask them to change their request.</p></div>}
              {worker && <StartWorkButton request={request} onStarted={refresh} />}
              {request.expiresAt && !closed && <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Response needed by {new Date(request.expiresAt).toLocaleString()}.</p>}
              <div className="mt-5 border-t border-[var(--border)] pt-4"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]"><MapPin size={14}/>Service address</h3><p className="mt-2 text-sm leading-6">{request.userAddress}</p></div><div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">The issue</h3><p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6">{request.description}</p></div>
            </section>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5"><h2 className="text-sm font-bold">Manage this booking</h2>{editable && (owner || worker || admin) && <div className="mt-3">{!cancelOpen ? <button className="text-sm text-[var(--danger)]" onClick={() => setCancelOpen(true)}>Cancel booking</button> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); act(() => requestAPI.cancelBooking(params.id, reason, Boolean(admin))); }}><label className="text-sm">Reason for cancelling<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="hf-input mt-2"/></label><p className="text-xs text-[var(--muted)]">Both people will be notified.</p><button disabled={busy} className="text-sm text-[var(--danger)]">Confirm cancellation</button><button type="button" className="ml-3 text-sm" onClick={() => setCancelOpen(false)}>Keep booking</button></form>}</div>}{request.cancellationReason && <p className="mt-3 text-sm text-[var(--muted)]">{request.cancellationReason}</p>}{closed && owner && <Link href="/workers" className="mt-3 block text-sm text-[var(--brand)]">Find another professional</Link>}{owner && request.sessionId && ['IN_PROGRESS','PRICE_SET','AWAITING_APPROVAL','PAYMENT_PENDING','COMPLETED'].includes(request.status) && <Link className="mt-3 block text-sm text-[var(--brand)]" href={`/chat?sessionId=${request.sessionId}`}>Price, payment and job updates</Link>}{worker && ['IN_PROGRESS','COMPLETED','PAYMENT_PENDING'].includes(request.status) && <Link href="/worker" className="mt-3 block text-sm text-[var(--brand)]">Manage work and price</Link>}<p className="mt-4 text-xs leading-5 text-[var(--muted)]">Keep agreements in this conversation. Never share passwords or payment codes.</p></section>
        </aside>
      </div>
    </>}

    {pendingCancel && <ConfirmDialog title="Cancel this request?" confirmLabel="Cancel request" busy={busy} error={cancelError} onCancel={() => setPendingCancel(false)} onConfirm={async () => {
      if (busy) return;
      setBusy(true); setCancelError('');
      try { await requestAPI.cancelRequest(params.id, 'ASSIGNED'); await refresh(); setPendingCancel(false); }
      catch (error) { setCancelError(getApiError(error, 'Could not cancel this request.')); await refresh().catch(() => {}); }
      finally { setBusy(false); }
    }}><p>The professional will no longer be able to accept this request. No new search will start automatically.</p></ConfirmDialog>}
  </main>;
}
