'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { workerAPI, requestAPI, getApiError } from '@/services/api';
import BookingAttachments, { BookingAttachment } from '@/components/BookingAttachments';
import HomeSafetyNotice from '@/components/HomeSafetyNotice';
export default function BookPage({ params }: { params: { workerId: string } }) {
  const user = useSelector((s: RootState) => s.auth.user);
  const router = useRouter();
  const [worker, setWorker] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<BookingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [checked, setChecked] = useState(false);
  const [form, setForm] = useState({ serviceKey: '', scheduledAt: '', description: '', userAddress: user?.address || '' });
  useEffect(() => {
    if (!user) { router.replace(`/login?next=${encodeURIComponent(`/book/${params.workerId}`)}`); return; }
    workerAPI.getAll().then(r => {
      const match = r.data.data.find((w: any) => w.id === params.workerId);
      if (!match) { setError('This professional is no longer accepting public requests. Please choose another.'); return; }
      setWorker(match); setForm(f => ({ ...f, serviceKey: match.services?.[0]?.category?.key || match.serviceKey || match.serviceType }));
    }).catch(e => setError(getApiError(e, 'Could not load this professional.'))).finally(() => setLoading(false));
  }, [params.workerId, user, router]);
  const services = worker?.services?.length ? worker.services.map((s: any) => s.category) : [{ key: worker?.serviceKey || worker?.serviceType, name: worker?.serviceKey || worker?.serviceType }];
  return <main className="portal-user min-h-screen bg-[var(--page)] px-4 pb-12 pt-6 text-[var(--text)] sm:px-6"><div className="mx-auto max-w-5xl">
    <nav className="flex min-h-10 items-center gap-6 pr-20 text-sm font-semibold text-[var(--muted)]"><Link href="/workers">Back to professionals</Link><Link href={user?.role === 'WORKER' ? '/worker' : '/dashboard'}>{user?.role === 'WORKER' ? 'Professional workspace' : 'My bookings'}</Link></nav>
    <header className="py-8"><p className="text-xs font-bold uppercase tracking-widest text-[var(--brand)]">Homeowner / Future booking</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Plan your home visit.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Choose when you need help and tell your professional about the issue. They will confirm the time before your visit is booked.</p></header>
    {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-500/5 p-4 text-sm text-[var(--danger)]">{error}</p>}
    {loading && <p role="status">Finding your professional...</p>}
    {user && user.role !== 'USER' ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6">You are signed in as a professional. Use a separate homeowner account to request service.<Link href="/worker" className="mt-4 block text-[var(--brand)]">Return to your professional workspace</Link></section> : worker && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-7"><h2 className="mb-6 text-lg font-bold">Your booking request</h2><form className="space-y-6" onSubmit={async e => { e.preventDefault(); if (busy || recording) return; setBusy(true); setError(''); try { const r = await requestAPI.bookAppointment({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString(), attachments, workerId: worker.id, safetyAcknowledged: checked }); router.push(`/bookings/${r.data.data.id}`); } catch (err) { setError(getApiError(err, 'Could not send your request.')); } finally { setBusy(false); } }}>
  <label className="block">Service<select className="hf-input mt-2" value={form.serviceKey} onChange={e => setForm({ ...form, serviceKey: e.target.value })}>{services.map((s: any) => <option key={s.key} value={s.key}>{String(s.name).replaceAll('_', ' ')}</option>)}</select></label>
  <div className="rounded-2xl bg-[var(--soft)] p-4"><p className="font-semibold">When would you like them to visit?</p><label className="mt-3 block text-sm">Date and time<input type="datetime-local" required className="hf-input mt-2" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })}/></label><p className="mt-2 text-xs text-[var(--muted)]">{Intl.DateTimeFormat().resolvedOptions().timeZone} / At least 15 minutes ahead. Confirmed only after the professional accepts.</p></div>
  <label className="block">Message to the professional<textarea required maxLength={2000} rows={4} className="hf-input mt-2 !h-32" placeholder="Describe the problem, where it is, and anything the professional should bring..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
  <label className="block">Service address<input required maxLength={300} className="hf-input mt-2" value={form.userAddress} onChange={e => setForm({ ...form, userAddress: e.target.value })}/></label>
  <BookingAttachments value={attachments} onChange={setAttachments} disabled={busy} onRecordingChange={setRecording}/>
  <HomeSafetyNotice checked={checked} onChange={setChecked}/><button disabled={busy || recording || !checked} className="hf-primary w-full px-4 py-3 disabled:opacity-50">{busy ? 'Sending...' : 'Send request to professional'}</button><Link href="/dashboard" className="block text-center text-sm text-blue-500">View existing bookings</Link>
  </form></section>
    <aside className="space-y-4 lg:sticky lg:top-6"><section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6"><p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Your professional</p><div className="mt-5 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-blue-500/10 text-xl font-bold text-[var(--brand)]">{worker.user?.name?.slice(0,1)}</div><div><h2 className="font-bold">{worker.user?.name}</h2><p className="mt-1 text-xs text-[var(--success)]">Zoon approved</p></div></div><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{worker.bio || 'Independent home-service professional'}</p><div className="mt-5 flex justify-between border-t border-[var(--border)] pt-4 text-sm"><span>{Number(worker.rating || 0).toFixed(1)} / 5 rating</span><span>{worker.totalJobs || 0} jobs</span></div></section>
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6"><h2 className="text-sm font-bold">What happens next?</h2><ol className="mt-4 space-y-4 text-sm text-[var(--muted)]"><li><b className="mr-2 text-[var(--brand)]">1</b>Send your preferred time and issue.</li><li><b className="mr-2 text-[var(--brand)]">2</b>Your professional reviews the request.</li><li><b className="mr-2 text-[var(--brand)]">3</b>Receive confirmation in your booking chat.</li></ol><p className="mt-5 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">Need to change plans? You can request another time or cancel before work starts.</p></section></aside></div>}
  </div></main>;
}
