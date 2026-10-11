'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { bookingReturn } from '@/services/booking-return';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, BriefcaseBusiness } from 'lucide-react';
import Brand from '@/components/Brand';
import { clearError, login } from '@/store/authSlice';
import type { AppDispatch, RootState } from '@/store';

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { loading, error, user } = useSelector((state: RootState) => state.auth);
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => { dispatch(clearError()); }, [dispatch]);


  return (
    <main className="hf-page portal-professional relative grid min-h-screen overflow-hidden lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#9f4933] via-[#D97757] to-[#e89a78] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl" />
        <Brand href="/" tone="light" />
        <div className="relative max-w-lg"><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-teal-300">Your professional workspace</p><h1 className="font-display text-5xl font-bold leading-[1.08] tracking-[-.05em]">Your skills. Your schedule. Your business.</h1><p className="mt-5 text-base leading-7 text-blue-100/70">Manage requests, plan appointments, and build a profile customers can trust.</p></div>
        <p className="text-xs text-blue-200/50">Trusted home services across Kerala</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden"><Brand href="/" /></div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-teal-600">Professional sign in</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-[var(--text)]">Good to see you again.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Enter your Zoon account details.</p>

          <form onSubmit={async event => { event.preventDefault(); const result = await dispatch(login({ ...form, portal: 'WORKER' })); if (login.fulfilled.match(result)) router.replace(result.payload.user.role === 'WORKER' ? (bookingReturn().startsWith('/bookings/') ? bookingReturn() : '/worker') : '/chat'); }} className="mt-7 space-y-4">
            <label className="block text-sm font-semibold text-[var(--text)]">Email address<input type="email" autoComplete="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" className="hf-input mt-2" /></label>
            <label className="block text-sm font-semibold text-[var(--text)]"><span className="flex justify-between">Password<Link href="/forgot-password" className="text-xs text-blue-600">Forgot password?</Link></span><input type="password" autoComplete="current-password" minLength={8} required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" className="hf-input mt-2" /></label>
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</div>}
            <button disabled={loading} className="hf-primary flex w-full items-center justify-center gap-2 px-5 py-3.5 disabled:cursor-wait disabled:opacity-60">{loading ? 'Signing in…' : 'Continue'}{!loading && <ArrowRight size={17} />}</button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--muted)]">New to Zoon? <Link href="/professional-register" className="font-bold text-blue-600">Create an account</Link></p>
          <Link href="/login" className="mt-5 block text-center text-sm font-bold text-blue-600">Homeowner sign in</Link><div className="mt-7 border-t border-[var(--border)] pt-6"><Link href="/professional-register" className="flex items-center justify-center gap-2 rounded-xl bg-[var(--soft)] px-3 py-2.5 text-xs font-bold text-[var(--text)]"><BriefcaseBusiness size={15}/>Join as a professional</Link></div>
        </div>
      </section>
    </main>
  );
}
