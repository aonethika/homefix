 'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCcw } from 'lucide-react';
import { uploadToS3, UploadPurpose } from '@/services/upload';

type Side = 'front' | 'left' | 'right';
type Shots = Record<Side, string>;
const steps: { id: Side; title: string }[] = [{ id: 'front', title: 'Look straight ahead' }, { id: 'left', title: 'Turn to your left' }, { id: 'right', title: 'Turn to your right' }];
const empty = (): Shots => ({ front: '', left: '', right: '' });
export default function FaceCheck({ onReady, disabled = false }: { onReady: (shots: Shots | null) => void; disabled?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const callback = useRef(onReady); callback.current = onReady;
  const previewRefs = useRef<Shots>(empty());
  const [shots, setShots] = useState<Shots>(empty);
  const [previews, setPreviews] = useState<Shots>(empty);
  const [step, setStep] = useState<Side>('front');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const complete = Boolean(shots.front && shots.left && shots.right);
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (video.current) video.current.srcObject = null; setReady(false); };
  useEffect(() => () => {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    Object.values(previewRefs.current).forEach(url => { if (url) URL.revokeObjectURL(url); });
  }, []);
  const start = async () => {
    if (locked.current || disabled) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Camera access needs HTTPS or localhost and a browser with camera support.'); return; }
    const attempt = ++generation.current;
    locked.current = true; setBusy(true); setError(''); stop();
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (attempt !== generation.current || !video.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      video.current.srcObject = acquired;
      await video.current.play();
      if (attempt === generation.current) setReady(true);
    } catch (err: any) {
      if (attempt !== generation.current) return;
      stop();
      setError(err.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow camera access in your browser settings, then try again.' : err.name === 'NotFoundError' ? 'No camera was found. Connect a camera and try again.' : 'Camera could not start. Close other apps using it and try again.');
    } finally { if (attempt === generation.current) { locked.current = false; setBusy(false); } }
  };
  const capture = async () => {
    if (locked.current || disabled || !ready || !video.current?.videoWidth || !stream.current?.active) return;
    const attempt = generation.current;
    locked.current = true; setBusy(true); setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not capture a camera frame.');
      context.drawImage(video.current, 0, 0); // Only the preview is mirrored.
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Capture failed. Please try again.')), 'image/jpeg', 0.9));
      if (attempt !== generation.current) return;
      const key = await uploadToS3(blob, `face_${step}` as UploadPurpose);
      if (attempt !== generation.current) return;
      if (previewRefs.current[step]) URL.revokeObjectURL(previewRefs.current[step]);
      previewRefs.current[step] = URL.createObjectURL(blob);
      setPreviews({ ...previewRefs.current });
      const next = { ...shots, [step]: key }; setShots(next);
      const missing = steps.find(s => !next[s.id]);
      if (missing) setStep(missing.id);
      else { callback.current(next); stop(); }
    } catch (err: any) { if (attempt === generation.current) setError(err.message || 'Could not upload this photo. Try again.'); }
    finally { if (attempt === generation.current) { locked.current = false; setBusy(false); } }
  };
  const retake = (side: Side) => {
    if (busy || disabled) return;
    callback.current(null); // Invalidate the parent's submit state immediately.
    setShots(current => ({ ...current, [side]: '' })); setStep(side); setError('');
    if (previewRefs.current[side]) URL.revokeObjectURL(previewRefs.current[side]);
    previewRefs.current[side] = ''; setPreviews({ ...previewRefs.current });
  };
  return <section aria-label="Live camera check" className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-5">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-[var(--text)]">Live camera check</h2><p className="mt-1 text-sm text-[var(--muted)]">Take three camera photos. Remove sunglasses, use even lighting, and keep only your face in view.</p></div>{complete && <CheckCircle2 aria-label="Camera check uploaded" className="shrink-0 text-[var(--success)]"/>}</div>
    <div className={`relative mx-auto mt-4 aspect-[4/3] max-w-md overflow-hidden rounded-2xl bg-slate-950 ${complete ? 'hidden' : ''}`}>
      <video ref={video} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover"/>
      {!ready && <p className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-white">{busy ? 'Opening camera...' : 'Enable your camera to begin.'}</p>}
      {ready && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-[85%] w-[48%] rounded-[50%] border-2 border-white/80"/></div>}
    </div>
    {!complete && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-[var(--text)]">{steps.find(s => s.id === step)?.title}</p><button type="button" disabled={busy || disabled} onClick={ready ? capture : start} className="hf-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50"><Camera size={16}/>{busy ? 'Please wait...' : ready ? 'Capture and upload' : 'Enable camera'}</button>{ready && <button type="button" disabled={busy || disabled} onClick={stop} className="text-xs text-[var(--muted)]">Stop camera</button>}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
    <div className="mt-4 grid grid-cols-3 gap-3">{steps.map(s => <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--soft)] p-2 text-center">{previews[s.id] ? <img src={previews[s.id]} alt={`${s.id} camera capture`} className="mb-2 aspect-square w-full rounded-lg object-cover"/> : <Camera className="mx-auto my-5 text-[var(--muted)]"/>}<p className="text-xs font-semibold capitalize text-[var(--text)]">{s.id} {shots[s.id] ? 'uploaded' : 'required'}</p>{shots[s.id] && <button type="button" disabled={busy || disabled} onClick={() => retake(s.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--brand)] disabled:opacity-50"><RefreshCcw size={12}/>Retake</button>}</div>)}</div>
  </section>;
}
