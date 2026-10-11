'use client';

import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ArrowRight, BadgeCheck, Clock3, Droplets, Hammer, Snowflake, Sparkles, Star, Zap } from 'lucide-react';
import { RootState } from '@/store';
import Brand from '@/components/Brand';

const services = [
  { icon: Droplets, name: 'Plumbing', desc: 'Leaks, clogs & fittings', tint: 'text-[var(--brand)] bg-sky-400/10' },
  { icon: Zap, name: 'Electrical', desc: 'Wiring, faults & fixtures', tint: 'text-[var(--brand)] bg-amber-400/10' },
  { icon: Snowflake, name: 'AC service', desc: 'Cooling, gas & repairs', tint: 'text-[var(--brand)] bg-cyan-400/10' },
  { icon: Hammer, name: 'Carpentry', desc: 'Doors, furniture & polish', tint: 'text-[var(--brand)] bg-blue-400/10' },
];

export default function HomePage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const primaryHref = user ? (user.role === 'WORKER' ? '/worker' : user.role === 'ADMIN' ? '/' : '/chat') : '/login';

  return (
    <div className="app-shell portal-user">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-5">
            <Link href="/workers" className="hidden text-sm text-[var(--muted)] transition hover:text-[var(--text)] sm:block">Professionals</Link>
            {!user && <Link href="/login" className="px-3 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--text)]">Sign in</Link>}
            <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-xl bg-blue-400 px-4 py-2.5 text-sm font-bold text-[#090e1d] transition hover:-translate-y-0.5 hover:bg-blue-300">
              {user ? 'Open workspace' : 'Book a service'} <ArrowRight size={15} />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:pb-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-blue-300/[.07] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">
              <Sparkles size={13} /> One chat. The right expert. Done.
            </div>
            <h1 className="text-balance font-display text-[2.75rem] font-bold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[4.4rem]">
              Home repairs without the <span className="text-[var(--brand)]">runaround.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Tell us what broke. Zoon understands the issue, finds a trusted professional nearby, and keeps everything—from arrival to payment—in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-6 py-3.5 font-bold text-[#090e1d] shadow-[0_14px_40px_rgba(52,211,153,.18)] transition hover:-translate-y-0.5 hover:bg-blue-300">
                Describe your issue <ArrowRight size={18} />
              </Link>
              <Link href="/workers" className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--soft)] px-6 py-3.5 font-semibold text-[var(--text)] transition hover:bg-[var(--soft)]">Browse professionals</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-2"><BadgeCheck size={16} className="text-[var(--brand)]" /> Verified experts</span>
              <span className="flex items-center gap-2"><Clock3 size={16} className="text-[var(--brand)]" /> Real-time updates</span>
              <span className="flex items-center gap-2"><Star size={16} className="text-[var(--brand)]" /> Rated service</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
            <div className="absolute -inset-8 rounded-full bg-blue-400/[.06] blur-3xl" />
            <div className="card float-slow relative overflow-hidden rounded-[2rem] p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-400 text-[#090e1d]"><Sparkles size={19} /></span><div><p className="font-semibold">FixBot</p><p className="text-xs text-[var(--brand)]">Ready to help</p></div></div>
                <span className="rounded-full bg-blue-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">Online</span>
              </div>
              <div className="space-y-4 py-2">
                <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-[var(--soft)] px-4 py-3 text-sm leading-6 text-[var(--text)]">What can I help you fix today?</div>
                <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-blue-400 px-4 py-3 text-sm font-medium leading-6 text-[#0b1020]">Water is leaking under my kitchen sink.</div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-[var(--soft)] px-4 py-3 text-sm leading-6 text-[var(--text)]"><span className="font-semibold text-[var(--brand)]">Plumbing issue detected.</span><br />I’ll find an available plumber near you now.</div>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-2 pl-4 text-sm text-[var(--muted)]"><span className="flex-1">Describe your issue…</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-400 text-[#0b1020]"><ArrowRight size={17} /></span></div>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[var(--soft)]">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <div className="mb-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="eyebrow">Help for the everyday</p><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] sm:text-4xl">One place for every fix.</h2></div><p className="max-w-sm text-sm leading-6 text-[var(--muted)]">Book in a few messages and follow the job from request to completion.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {services.map(({ icon: Icon, name, desc, tint }) => <Link href={user ? '/chat' : '/login'} key={name} className="group card rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:border-[var(--border)]"><span className={`mb-7 grid h-11 w-11 place-items-center rounded-xl ${tint}`}><Icon size={21} /></span><h3 className="font-display font-bold">{name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{desc}</p><ArrowRight size={17} className="mt-5 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--brand)]" /></Link>)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="card grid gap-10 overflow-hidden rounded-[2rem] p-7 sm:p-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div><p className="eyebrow">Simple by design</p><h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-[-.04em] sm:text-4xl">From problem to professional in minutes.</h2><p className="mt-4 text-[var(--muted)]">No phone tag, confusing forms, or hunting through listings.</p></div>
            <ol className="space-y-3">{[['01','Tell us what happened','Chat naturally—no service category required.'],['02','We find your best match','Available professionals are matched by skill and location.'],['03','Track, approve, and pay','Get live updates and finish securely in one flow.']].map(([n,title,desc]) => <li key={n} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-4"><span className="font-display text-sm font-bold text-[var(--brand)]">{n}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-5 text-[var(--muted)]">{desc}</p></div></li>)}</ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand /><p>Trusted home services, built for Kerala.</p><p>© 2026 Zoon</p></div></footer>
    </div>
  );
}
