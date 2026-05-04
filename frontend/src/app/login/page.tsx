'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '@/store/authSlice';
import { RootState, AppDispatch } from '@/store';

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { loading, error, user } = useSelector((s: RootState) => s.auth);

  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => {
    if (!user) return;
    if (user.role === 'WORKER') router.replace('/worker');
    else if (user.role === 'ADMIN') router.replace('/admin');
    else router.replace('/chat');
  }, [user]);

  useEffect(() => {
    dispatch(clearError());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(login(form));
  };

  const fillDemo = (role: string) => {
    const demo = {
      user: { email: 'user@homefix.com', password: 'password123' },
      worker: { email: 'plumber@homefix.com', password: 'password123' },
      admin: { email: 'admin@homefix.com', password: 'password123' },
    };
    setForm(demo[role as keyof typeof demo]);
  };

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#418e4d] flex items-center justify-center text-lg text-white shadow-md">
              🏠
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">
              HomeFix
            </span>
          </Link>

          <h1 className="text-2xl font-semibold text-white">
            Welcome back
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-1">
            Sign in to your account
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {['user', 'worker', 'admin'].map(role => (
            <button
              key={role}
              onClick={() => fillDemo(role)}
              className="py-1.5 text-xs capitalize bg-[#18181b] border border-[#2a2a30] hover:border-[#418e4d]/40 text-[#a1a1aa] hover:text-[#6ee7b7] rounded-lg transition"
            >
              Demo {role}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#2a2a30]" />
          <span className="text-[10px] uppercase tracking-widest text-[#52525b]">
            or sign in
          </span>
          <div className="flex-1 h-px bg-[#2a2a30]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-xs text-[#a1a1aa] mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-[#418e4d] focus:ring-2 focus:ring-[#418e4d]/20 rounded-xl px-4 py-3 text-sm text-white placeholder-[#52525b] outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs text-[#a1a1aa] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="w-full bg-[#18181b] border border-[#2a2a30] focus:border-[#418e4d] focus:ring-2 focus:ring-[#418e4d]/20 rounded-xl px-4 py-3 text-sm text-white placeholder-[#52525b] outline-none transition"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#418e4d] hover:bg-[#357a41] disabled:opacity-50 text-white font-medium rounded-xl transition shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

        </form>

        <p className="text-center text-sm text-[#52525b] mt-6">
          Don’t have an account?{' '}
          <Link
            href="/register"
            className="text-[#6ee7b7] hover:text-[#34d399] font-medium transition"
          >
            Create one
          </Link>
        </p>

      </div>
    </div>
  );
}