'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Mic, Phone, Send, Square } from 'lucide-react';
import { getApiError, requestAPI } from '@/services/api';
import { notify } from './NotificationToast';
import InAppCallModal from './InAppCallModal';

export default function RequestConversation({ request, onSent }: { request: any; onSent: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messages = (request.session?.messages || []).filter((message: any) => message.metadata?.kind === 'CONVERSATION');

  const send = async (payload: any) => {
    setSending(true);
    try { await requestAPI.sendMessage(request.id, payload); setText(''); onSent(); }
    catch (err) { notify({ title: 'Message not sent', message: getApiError(err, 'Please try again.') }); }
    finally { setSending(false); }
  };
  const image = (file?: File) => {
    if (!file) return;
    if (file.size > 6_000_000) return notify({ title: 'Image is too large', message: 'Choose an image under 6 MB.' });
    const reader = new FileReader();
    reader.onload = () => send({ mediaType: 'IMAGE', mediaData: String(reader.result), fileName: file.name });
    reader.readAsDataURL(file);
  };
  const voice = async () => {
    if (recording) return recorderRef.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const reader = new FileReader();
        reader.onload = () => send({ mediaType: 'AUDIO', mediaData: String(reader.result), fileName: 'voice-note.webm' });
        reader.readAsDataURL(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
      };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
    } catch { notify({ title: 'Microphone unavailable', message: 'Allow microphone access to record a voice note.' }); }
  };

  return <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-3">
    <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand)]">Issue conversation</p>{['ACCEPTED','IN_PROGRESS'].includes(request.status) && <button onClick={() => setCallOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-teal-500/15 px-2.5 py-1.5 text-[10px] font-bold text-[var(--brand)]"><Phone size={12}/>Private call</button>}</div>
    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
      {messages.length === 0 ? <p className="py-3 text-center text-[11px] text-[var(--muted)]">No extra details yet. Ask the customer what tools or parts may be needed.</p> : messages.map((message: any) => <div key={message.id} className={`rounded-xl p-2.5 text-[11px] ${message.role === 'worker' ? 'ml-8 bg-blue-500/15 text-[var(--brand)]' : 'mr-8 bg-[var(--soft)] text-[var(--muted)]'}`}><b className="mb-1 block text-[9px] uppercase text-[var(--muted)]">{message.metadata?.senderName || (message.role === 'worker' ? 'You' : 'Customer')}</b>{message.metadata?.mediaType === 'IMAGE' && <img src={message.metadata.mediaData} alt="Issue" className="mb-2 max-h-40 rounded-lg object-cover"/>}{message.metadata?.mediaType === 'AUDIO' && <audio controls src={message.metadata.mediaData} className="mb-2 w-full"/>}<span>{message.content}</span></div>)}
    </div>
    <div className="mt-3 flex gap-1.5">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { image(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
      <button onClick={() => fileRef.current?.click()} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--soft)] text-[var(--muted)]" aria-label="Send image"><ImagePlus size={15}/></button>
      <button onClick={voice} className={`grid h-9 w-9 place-items-center rounded-lg ${recording ? 'bg-rose-500 text-white' : 'bg-[var(--soft)] text-[var(--muted)]'}`} aria-label="Record voice note">{recording ? <Square size={13} fill="currentColor"/> : <Mic size={15}/>}</button>
      <input value={text} onChange={event => setText(event.target.value.slice(0, 2000))} onKeyDown={event => { if (event.key === 'Enter' && text.trim()) send({ content: text }); }} placeholder="Ask about the issue…" className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--soft)] px-3 text-xs text-[var(--text)] outline-none focus:border-blue-400"/>
      <button disabled={!text.trim() || sending} onClick={() => send({ content: text })} className="grid h-9 w-9 place-items-center rounded-lg bg-blue-500 text-white disabled:opacity-40"><Send size={14}/></button>
    </div>
    {callOpen && <InAppCallModal name={request.user?.name || 'Customer'} onClose={() => setCallOpen(false)}/>}
  </div>;
}
