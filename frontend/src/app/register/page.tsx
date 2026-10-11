'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bookingReturn } from '@/services/booking-return';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, CheckCircle2, Wrench } from 'lucide-react';
import Brand from '@/components/Brand';
import LocationPicker, { PickedLocation } from '@/components/LocationPicker';
import { clearError, register } from '@/store/authSlice';
import type { AppDispatch, RootState } from '@/store';

export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [next, setNext] = useState('/chat');
  useEffect(() => { setNext(bookingReturn()); }, []);
  const { loading, error, user } = useSelector((state: RootState) => state.auth);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', location: {} as Partial<PickedLocation> });
  useEffect(() => { dispatch(clearError()); }, [dispatch]);
  useEffect(() => { if (user) router.replace(user.role === 'WORKER' ? '/worker' : bookingReturn()); }, [router, user]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await dispatch(register({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined, address: form.location.address, latitude: form.location.latitude, longitude: form.location.longitude }));
  };
  return <main className="hf-page portal-user flex min-h-screen items-center justify-center px-4 py-10 sm:px-6"><div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] hf-panel lg:grid-cols-[.85fr_1.15fr]">
    <aside className="relative overflow-hidden bg-gradient-to-br from-[#9f4933] via-[#D97757] to-[#e89a78] p-8 text-white sm:p-10"><div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" /><Brand tone="light" /><div className="relative mt-20"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-100">Homeowner account</p><h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-.05em]">A faster way to get your home fixed.</h1><div className="mt-8 space-y-4 text-sm text-orange-50/85">{['Chat naturally about the problem','Get matched with an approved professional','Track every update and pay securely'].map(item => <p key={item} className="flex items-center gap-3"><CheckCircle2 size={18} className="text-amber-300" />{item}</p>)}</div></div><Link href="/professional-register" className="relative mt-16 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm font-semibold backdrop-blur transition hover:bg-white/15"><Wrench size={19} /><span className="flex-1">Are you a professional?<small className="mt-0.5 block font-normal text-white/65">Apply to join our network</small></span><ArrowRight size={17} /></Link></aside>
    <section className="p-6 sm:p-10 lg:p-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-600">Create your account</p><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-[var(--text)]">Let’s get you set up.</h2><p className="mt-2 text-sm text-[var(--muted)]">Required fields are kept short. You can update details later.</p><form onSubmit={submit} className="mt-8 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[var(--text)]">Full name<input required autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="hf-input mt-2" placeholder="Your name" /></label><label className="text-sm font-semibold text-[var(--text)]">Phone number<input autoComplete="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="hf-input mt-2" placeholder="+91 98765 43210" /></label></div>
      <label className="block text-sm font-semibold text-[var(--text)]">Email address<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="hf-input mt-2" placeholder="you@example.com" /></label><label className="block text-sm font-semibold text-[var(--text)]">Password<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="hf-input mt-2" placeholder="At least 8 characters" /></label>
      <LocationPicker value={form.location} onChange={location => setForm({ ...form, location })} />{error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button disabled={loading} className="hf-primary flex w-full items-center justify-center gap-2 px-5 py-3.5 disabled:opacity-60">{loading ? 'Creating account…' : 'Create homeowner account'}{!loading && <ArrowRight size={17} />}</button>
    </form><p className="mt-6 text-center text-sm text-[var(--muted)]">Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-blue-600">Sign in</Link></p></section>
  </div></main>;
}
