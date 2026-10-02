'use client';

import { useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';

export default function InAppCallModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-xl">
    <div className="w-full max-w-sm rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-8 text-center text-[var(--text)] shadow-2xl">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-teal-400 text-3xl font-black">{name.slice(0, 1).toUpperCase()}</div>
      <p className="mt-6 text-xl font-bold">{name}</p>
      <p className="mt-1 text-sm text-teal-300">Private zoon call · {time}</p>
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Demo in-app call. Personal phone numbers remain private.</p>
      <div className="mt-8 flex justify-center gap-4">
        <button onClick={() => setMuted(value => !value)} className="grid h-14 w-14 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Toggle microphone">{muted ? <MicOff /> : <Mic />}</button>
        <button onClick={onClose} className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 hover:bg-rose-400" aria-label="End call"><PhoneOff /></button>
        <button onClick={() => setSpeaker(value => !value)} className="grid h-14 w-14 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Toggle speaker">{speaker ? <Volume2 /> : <VolumeX />}</button>
      </div>
    </div>
  </div>;
}
