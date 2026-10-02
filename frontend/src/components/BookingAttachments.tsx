'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Mic, Square, X } from 'lucide-react';
export type BookingAttachment = { mediaType: 'IMAGE' | 'AUDIO'; mediaData: string; fileName: string };
export default function BookingAttachments({ value, onChange, disabled, onRecordingChange }: { value: BookingAttachment[]; onChange: (items: BookingAttachment[]) => void; disabled?: boolean; onRecordingChange?: (recording: boolean) => void }) {
  const [recording, setRecording] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(value); latest.current = value;
  useEffect(() => () => { if (recorder.current) recorder.current.onstop = null; if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); clearTimeout(timer.current); }, []);
  const add = async (blob: Blob, mediaType: 'IMAGE' | 'AUDIO', fileName: string) => {
    setError(''); setReading(true); onRecordingChange?.(true);
    try {
      if (latest.current.length >= 3 || blob.size > 6000000) throw new Error('Use up to 3 attachments, under 6 MB in total.');
      const mediaData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this file. Please try again.')); reader.readAsDataURL(blob); });
      if (latest.current.reduce((n, a) => n + a.mediaData.length, mediaData.length) > 8000000) throw new Error('Your attachments are too large. Keep the total under 6 MB.');
      onChange([...latest.current, { mediaType, mediaData, fileName }]);
    } catch (e: any) { setError(e.message); } finally { setReading(false); onRecordingChange?.(false); }
  };
  const voice = async () => {
    if (recording) { recorder.current?.stop(); return; }
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const current = new MediaRecorder(stream.current); recorder.current = current;
      const chunks: Blob[] = [];
      current.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      current.onstop = () => { clearTimeout(timer.current); stream.current?.getTracks().forEach(t => t.stop()); setRecording(false); add(new Blob(chunks, { type: current.mimeType || 'audio/webm' }), 'AUDIO', 'voice-note'); };
      current.start(); setRecording(true); onRecordingChange?.(true);
      timer.current = setTimeout(() => { if (current.state === 'recording') current.stop(); }, 60000);
    } catch { stream.current?.getTracks().forEach(t => t.stop()); setError('Allow microphone access in your browser to record a voice note.'); onRecordingChange?.(false); }
  };
  return <div className="space-y-3"><div className="flex flex-wrap gap-3"><input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const selected = e.target.files?.[0]; if (selected) { if (!['image/jpeg','image/png','image/webp'].includes(selected.type)) setError('Choose a JPG, PNG or WebP photo.'); else add(selected, 'IMAGE', selected.name); } e.currentTarget.value = ''; }}/><button type="button" disabled={disabled || reading || recording || value.length >= 3} onClick={() => file.current?.click()} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40"><ImagePlus size={17}/>Add photo</button><button type="button" disabled={disabled || reading || (!recording && value.length >= 3)} onClick={voice} className={`flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40 ${recording ? 'text-[var(--danger)]' : ''}`}>{recording ? <Square size={17}/> : <Mic size={17}/>}{recording ? 'Stop recording' : 'Record voice note'}</button></div><p className="text-xs text-[var(--muted)]">Up to 3 attachments, 6 MB total. Voice notes stop after one minute.</p>{recording && <p role="status" className="text-sm text-[var(--danger)]">Recording… stop to preview your voice note.</p>}{value.map((a, i) => <div key={i} className="relative rounded-xl border border-[var(--border)] p-3">{a.mediaType === 'IMAGE' ? <img src={a.mediaData} alt="Issue attachment preview" className="max-h-40 rounded-lg"/> : <audio controls src={a.mediaData} className="w-full pr-9"/>}<button type="button" disabled={disabled} aria-label="Remove attachment" onClick={() => onChange(value.filter((_, n) => n !== i))} className="absolute right-2 top-2 rounded-full bg-[var(--panel)] p-1"><X size={18}/></button></div>)}{error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}</div>;
}
