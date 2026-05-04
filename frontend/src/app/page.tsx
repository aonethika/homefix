'use client';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';

export default function HomePage() {
  const { user } = useSelector((s: RootState) => s.auth);

  const services = [
    { emoji: '🔧', name: 'Plumber', desc: 'Leaks, clogs, drainage' },
    { emoji: '⚡', name: 'Electrician', desc: 'Wiring, faults, fittings' },
    { emoji: '❄️', name: 'AC Technician', desc: 'Servicing, gas, repair' },
    { emoji: '🪵', name: 'Carpenter', desc: 'Furniture, doors, polish' },
  ];

  const steps = [
    { n: '01', title: 'Describe Your Issue', desc: 'Just chat naturally — our AI understands what you need.' },
    { n: '02', title: 'Get Matched', desc: 'We find the best professional near you in seconds.' },
    { n: '03', title: 'Job Done & Pay', desc: 'Worker completes the job, you approve price and pay safely.' },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">

      <nav className="border-b border-[#2a2a30] px-4 sm:px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#418e4d] to-[#357a41] flex items-center justify-center shadow-lg shadow-[#418e4d]/30">🏠</div>
          <span className="font-bold text-base sm:text-lg text-white">HomeFix</span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href={user.role === 'WORKER' ? '/worker' : '/chat'}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-[#418e4d] to-[#357a41] hover:from-[#4fa65b] hover:to-[#3f8c4b] text-white text-xs sm:text-sm font-semibold rounded-xl transition-all"
            >
              {user.role === 'WORKER' ? 'Dashboard →' : 'Open Chat →'}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-xs sm:text-sm text-[#a8a29e] hover:text-white">Login</Link>
              <Link href="/register" className="px-3 sm:px-4 py-2 bg-gradient-to-r from-[#418e4d] to-[#357a41] text-white text-xs sm:text-sm font-semibold rounded-xl">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#418e4d]/10 border border-[#418e4d]/20 rounded-full text-[10px] sm:text-xs text-[#6ee7b7] mb-6 sm:mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#418e4d]" />
          AI-Powered Home Services
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4 sm:mb-6">
          Home repairs,<br />
          <span className="text-[#6ee7b7]">solved with a chat</span>
        </h1>

        <p className="text-sm sm:text-lg text-[#a8a29e] max-w-xl mx-auto mb-8 sm:mb-10">
          Describe your problem in plain language. We detect the issue, find the best professional, and manage everything.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href={user ? '/chat' : '/register'}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#418e4d] to-[#357a41] text-white font-semibold rounded-xl text-sm sm:text-base"
          >
            Start Chat →
          </Link>

          <Link
            href="/workers"
            className="w-full sm:w-auto px-6 py-3 bg-[#18181b] border border-[#2a2a30] text-[#a8a29e] hover:text-white rounded-xl text-sm sm:text-base"
          >
            Browse Workers
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <p className="text-center text-[10px] sm:text-xs uppercase tracking-widest text-[#57534e] mb-6 sm:mb-8">
          Services
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {services.map(s => (
            <div key={s.name} className="bg-[#18181b] border border-[#2a2a30] rounded-xl p-4 text-center">
              <div className="text-2xl sm:text-3xl mb-2">{s.emoji}</div>
              <p className="font-semibold text-white text-xs sm:text-sm">{s.name}</p>
              <p className="text-[10px] sm:text-[11px] text-[#57534e]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <p className="text-center text-[10px] sm:text-xs uppercase tracking-widest text-[#57534e] mb-8">
          How It Works
        </p>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((step, i) => (
            <div key={i} className="bg-[#18181b] border border-[#2a2a30] rounded-xl p-4 sm:p-6">
              <p className="text-2xl font-bold text-[#2a2a30] mb-2">{step.n}</p>
              <p className="font-semibold text-white mb-1">{step.title}</p>
              <p className="text-xs sm:text-sm text-[#a8a29e]">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-gradient-to-br from-[#418e4d]/10 to-transparent border border-[#418e4d]/20 rounded-2xl p-6 sm:p-10 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-2">Ready to fix it?</h2>
          <p className="text-[#a8a29e] mb-6 text-sm">Join homeowners using HomeFix.</p>

          <Link
            href={user ? '/chat' : '/register'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#418e4d] to-[#357a41] text-white font-semibold rounded-xl text-sm"
          >
            <span>🏠</span>
            <span>Get Started</span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#2a2a30] py-6 text-center text-[10px] sm:text-xs text-[#57534e]">
        © 2026 HomeFix · Built for Kerala
      </footer>
    </div>
  );
}