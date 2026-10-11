'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import Brand from '@/components/Brand';
import { authAPI } from '@/services/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setError(''); try { const r = await authAPI.forgotPassword(email); setDevCode(r.data.data.developmentCode || ''); setStep('reset'); } catch (err: any) { setError(err.response?.data?.message || 'Could not send code'); } finally { setLoading(false); } };
  const reset = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setError(''); try { await authAPI.resetPassword({ email, code, password }); router.replace('/login'); } catch (err: any) { setError(err.response?.data?.message || 'Could not reset password'); } finally { setLoading(false); } };
  return <main className="hf-page portal-user grid min-h-screen place-items-center p-4"><div className="hf-panel w-full max-w-md rounded-[2rem] p-7 sm:p-9"><Brand /><span className="mt-10 grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-[#D97757]">{step === 'email' ? <KeyRound /> : <MailCheck />}</span><h1 className="mt-5 font-display text-3xl font-bold tracking-[-.04em] text-[var(--text)]">{step === 'email' ? 'Forgot your password?' : 'Check your email'}</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step === 'email' ? 'Enter your account email and we’ll send a six-digit code.' : `Enter the code sent to ${email} and choose a new password.`}</p>
    {step === 'email' ? <form onSubmit={request} className="mt-7 space-y-4"><input required type="email" className="hf-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /><button disabled={loading} className="hf-primary w-full px-4 py-3.5">{loading ? 'Sending…' : 'Send reset code'}</button></form> : <form onSubmit={reset} className="mt-7 space-y-4">{devCode && <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">Development code: <b className="tracking-widest">{devCode}</b>. Configure Resend to deliver OTP emails in production.</div>}<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="hf-input text-center text-xl tracking-[.45em]" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><input required minLength={8} type="password" className="hf-input" placeholder="New password (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} /><button disabled={loading} className="hf-primary w-full px-4 py-3.5">{loading ? 'Updating…' : 'Update password'}</button></form>}{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-[var(--brand)]"><ArrowLeft size={15} />Back to sign in</Link></div></main>;
}
