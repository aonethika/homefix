'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowUp, Clock3, History, ImagePlus, MapPin, Menu, MessageSquarePlus, Mic, Phone, PanelLeftClose, Sparkles, Square } from 'lucide-react';
import { addBotMessage, addChatMessage, addUserMessage, resetChat, stopChat, fetchSessions, loadSession, sendMessage as sendMsgThunk } from '@/store/chatSlice';
import { store, RootState, AppDispatch } from '@/store';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import PaymentModal from './PaymentModal';
import RatingModal from './RatingModal';
import { useSocket } from '@/hooks/useSocket';
import { SERVICE_LABELS } from '@/utils/formatTime';
import LocationPicker from './LocationPicker';
import LiveTrackingMap from './LiveTrackingMap';
import InAppCallModal from './InAppCallModal';
import HomeSafetyNotice from './HomeSafetyNotice';
import { chatAPI, getApiError, requestAPI } from '@/services/api';
import { notify } from './NotificationToast';
import ConfirmDialog from './ConfirmDialog';
import CancelRequestButton from './CancelRequestButton';
import LogoutButton from './LogoutButton';
import Link from 'next/link';
import SafetyShortcuts from './SafetyShortcuts';

const QUICK_PROMPTS = [
  { label: 'Leaking pipe', text: 'There is a pipe leaking in my bathroom' },
  { label: 'Power issue', text: 'There is no power in my living room' },
  { label: 'AC not cooling', text: 'My AC is running but not cooling properly' },
  { label: 'Broken door', text: 'My wooden door is broken and needs repair' },
];

export default function ChatBox() {
  const dispatch = useDispatch<AppDispatch>();
  const { messages, sending, loading, stopping, sessionId, sessions, currentRequest, error, state: chatState } = useSelector((s: RootState) => s.chat);
  const { user, token } = useSelector((s: RootState) => s.auth);
  const [input, setInput] = useState('');
  const [stopIntent, setStopIntent] = useState<{ kind: 'stop' | 'new' | 'navigate' | 'session'; destination?: string } | null>(null);
  const [stopError, setStopError] = useState('');
  const [restarting, setRestarting] = useState(false);
  const generation = useRef(0);
  const pendingMessage = useRef<{ abort: () => void } | null>(null);
  const pendingSearch = ['PENDING', 'SEARCHING', 'ASSIGNED'].includes(currentRequest?.status) || (!currentRequest && ['NEED_LOCATION', 'CHOOSE_WORKER', 'SEARCHING'].includes(chatState));
  const isClosed = chatState === 'COMPLETED' && (!currentRequest || ['CANCELLED', 'REJECTED'].includes(currentRequest.status));
  const [paymentData, setPaymentData] = useState<any>(null);
  const [ratingData, setRatingData] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [workerLocation, setWorkerLocation] = useState<{lat:number;lon:number;updatedAt?:string;accuracy?:number}|null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{lat:number;lon:number}|null>(null);
  const [recording, setRecording] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const [outstandingBooking, setOutstandingBooking] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const safetyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useSocket(token, user?.role);

  useEffect(() => {
    if (!user?.id || user.role !== 'USER') return;
    let active = true;
    requestAPI.getMyRequests().then(response => {
      if (!active) return;
      const requests = Array.isArray(response.data.data) ? response.data.data : [];
      const openStatuses = ['PENDING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PRICE_SET', 'AWAITING_APPROVAL', 'PAYMENT_PENDING', 'COMPLETED'];
      setOutstandingBooking(requests.find((request: any) => openStatuses.includes(request.status) && request.payment?.status !== 'PAID') || null);
    }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.role, currentRequest?.id, currentRequest?.status]);
  useEffect(() => { setSafetyAcknowledged(false); setSafetyError(''); }, [sessionId]);

  useEffect(() => {
    if (!user || !token) return;
    dispatch(fetchSessions());
    const saved = new URLSearchParams(window.location.search).get('sessionId') || localStorage.getItem('sessionId');
    if (saved) dispatch(loadSession(saved));
  }, [user, token, dispatch]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' }); }, [messages, sending, chatState]);
  useEffect(() => { const listener=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.requestId===currentRequest?.id && ['ACCEPTED','IN_PROGRESS'].includes(currentRequest?.status))setWorkerLocation(detail);}; window.addEventListener('Zoon:worker-location',listener); return()=>window.removeEventListener('Zoon:worker-location',listener); }, [currentRequest?.id, currentRequest?.status]);
  useEffect(() => { setWorkerLocation(null); }, [currentRequest?.id, currentRequest?.status]);

  const submitMessage = useCallback(async (raw: string, displayMessage?: string) => {
    const message = raw.trim();
    if (!message || sending || stopping || isClosed || store.getState().chat.sending) return;
    if (/^(cancel|close|finish|stop searching)$/i.test(message) && pendingSearch) { setStopIntent({ kind: 'stop' }); return; }
    const version = generation.current;
    const selectingProfessional = message.startsWith('SELECT_WORKER:');
    if (selectingProfessional && outstandingBooking && outstandingBooking.id !== currentRequest?.id) {
      setSafetyError('You have an unfinished booking. Complete payment or close it from My bookings before booking again.');
      return;
    }
    if (selectingProfessional && !safetyAcknowledged) {
      setSafetyError('Read and acknowledge the safety notice before sending a booking request.');
      safetyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setInput('');
    if (currentRequest?.id && ['SEARCHING', 'ASSIGNED'].includes(chatState) && currentRequest?.status !== 'AWAITING_APPROVAL') {
      try {
        const response = await requestAPI.sendMessage(currentRequest.id, { content: message });
        if (version === generation.current) dispatch(addChatMessage(response.data.data));
      } catch (err) {
        notify({ title: 'Message not sent', message: getApiError(err, 'Please try again.') });
      }
      inputRef.current?.focus();
      return;
    }
    dispatch(addUserMessage(displayMessage || message));
    const task = dispatch(sendMsgThunk({ message, sessionId: sessionId || undefined, safetyAcknowledged: selectingProfessional && safetyAcknowledged }));
    pendingMessage.current = task;
    const result = await task;
    if (version !== generation.current) return;
    pendingMessage.current = null;
    if (sendMsgThunk.fulfilled.match(result)) {
      localStorage.setItem('sessionId', result.payload.sessionId);
      await dispatch(loadSession(result.payload.sessionId));
      dispatch(fetchSessions());
    } else {
      dispatch(addBotMessage({ content: typeof result.payload === 'string' ? result.payload : 'Your request could not be sent. Please try again.' }));
    }
    inputRef.current?.focus();
  }, [dispatch, sending, sessionId, currentRequest?.id, chatState, outstandingBooking, safetyAcknowledged, stopping, isClosed, pendingSearch]);

  const handleAction = useCallback((action: string, data?: any) => {
    if (action === 'PAY') setPaymentData(data);
    if (action === 'RETRY_SEARCH') submitMessage('Search again');
    if (action === 'RATE') setRatingData(data);
    if (action === 'CONFIRM_SERVICE') submitMessage('Yes, find one');
    if (action === 'REJECT_SERVICE') submitMessage('No, let me describe it again');
    if (action === 'SELECT_WORKER') submitMessage(`SELECT_WORKER:${data.id}`, `Request ${data.name}`);
    if (action === 'APPROVE_PRICE') submitMessage('Yes, I approve the price');
    if (action === 'REJECT_PRICE') submitMessage('No, I decline the price');
  }, [submitMessage]);

  const openDraft = () => {
    generation.current++; pendingMessage.current?.abort();
    dispatch(resetChat()); localStorage.removeItem('sessionId');
    window.history.replaceState(null, '', '/chat');
    setInput(''); setSelectedLocation(null); setWorkerLocation(null); setSidebarOpen(false);
    inputRef.current?.focus();
  };
  const handleNewChat = () => {
    if (stopping || restarting) return;
    if (pendingSearch || sending) { setStopError(''); setStopIntent({ kind: 'new' }); return; }
    if (!messages.length && !currentRequest) { setSidebarOpen(false); return; }
    openDraft();
  };
  const openHistory = async (id: string) => {
    if (id === sessionId) { setSidebarOpen(false); return; }
    if (pendingSearch || sending) { setStopError(''); setStopIntent({ kind: 'session', destination: id }); return; }
    generation.current++; pendingMessage.current?.abort();
    await dispatch(loadSession(id)); localStorage.setItem('sessionId', id); setSidebarOpen(false);
    window.history.replaceState(null, '', `/chat?sessionId=${encodeURIComponent(id)}`);
  };
  const confirmStop = async () => {
    if (stopping || !sessionId) return;
    generation.current++; pendingMessage.current?.abort(); setStopError('');
    const result = await dispatch(stopChat({ sessionId, expectedStatus: currentRequest?.status }));
    if (!stopChat.fulfilled.match(result)) {
      setStopError(String(result.payload || 'Could not stop the search. Please try again.'));
      await dispatch(loadSession(sessionId));
      return;
    }
    setOutstandingBooking(null); setLocating(false); setWorkerLocation(null);
    if (recorderRef.current?.state === 'recording') { recorderRef.current.onstop = null; recorderRef.current.stream.getTracks().forEach(track => track.stop()); recorderRef.current.stop(); setRecording(false); }
    const intent = stopIntent; setStopIntent(null); setInput('');
    await dispatch(loadSession(sessionId)); dispatch(fetchSessions());
    if (intent?.kind === 'new') openDraft();
    if (intent?.kind === 'navigate' && intent.destination) window.location.assign(intent.destination);
    if (intent?.kind === 'session' && intent.destination) {
      await dispatch(loadSession(intent.destination)); localStorage.setItem('sessionId', intent.destination); setSidebarOpen(false);
      window.history.replaceState(null, '', `/chat?sessionId=${encodeURIComponent(intent.destination)}`);
    }
  };
  const findAnother = async () => {
    if (restarting || stopping || !sessionId) return;
    setRestarting(true);
    try {
      const response = await chatAPI.restartSession(sessionId);
      const fresh = response.data.data;
      generation.current++;
      await dispatch(loadSession(fresh.id)); localStorage.setItem('sessionId', fresh.id);
      window.history.replaceState(null, '', `/chat?sessionId=${encodeURIComponent(fresh.id)}`);
      setOutstandingBooking(null); setSafetyAcknowledged(false); setInput('');
      if (fresh.state === 'NEED_LOCATION') {
        const result = await dispatch(sendMsgThunk({ sessionId: fresh.id, message: 'Search again' }));
        if (sendMsgThunk.fulfilled.match(result) && store.getState().chat.sessionId === fresh.id && !store.getState().chat.stopping && store.getState().chat.state !== 'COMPLETED') await dispatch(loadSession(fresh.id));
      }
      dispatch(fetchSessions());
    } catch (error) { notify({ title: 'Could not start a new search', message: getApiError(error, 'Try again.') }); }
    finally { setRestarting(false); }
  };
  useEffect(() => {
    if (!pendingSearch && !sending) return;
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.protocol === 'tel:' || link.origin !== window.location.origin) return;
      if (link.pathname === '/chat' && link.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation(); setStopError(''); setStopIntent({ kind: 'navigate', destination: link.href });
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    document.addEventListener('click', leave, true); window.addEventListener('beforeunload', beforeUnload);
    return () => { document.removeEventListener('click', leave, true); window.removeEventListener('beforeunload', beforeUnload); };
  }, [pendingSearch, sending]);
  useEffect(() => () => { generation.current++; pendingMessage.current?.abort(); }, []);

  const shareLocation = () => {
    if (!navigator.geolocation || locating) return;
    const version = generation.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (version !== generation.current) return;
        setLocating(false);
        setSelectedLocation({lat:coords.latitude,lon:coords.longitude});
        let address = 'Current location shared';
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`, { headers: { 'Accept-Language': 'en' } });
          if (response.ok) address = (await response.json()).display_name || address;
        } catch {}
        if (version !== generation.current) return;
        submitMessage(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} | ${address}`, address);
      },
      () => { setLocating(false); dispatch(addBotMessage({ content: 'Location access was unavailable. Type your area or address instead.' })); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const sendMedia = useCallback(async (mediaType: 'IMAGE' | 'AUDIO', mediaData: string, fileName?: string) => {
    if (!currentRequest?.id) return;
    try {
      const response = await requestAPI.sendMessage(currentRequest.id, { mediaType, mediaData, fileName });
      dispatch(addChatMessage(response.data.data));
    } catch (err) {
      notify({ title: 'Attachment not sent', message: getApiError(err, 'Please try a smaller file.') });
    }
  }, [currentRequest?.id, dispatch]);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (file.size > 6_000_000) return notify({ title: 'Image is too large', message: 'Choose an image under 6 MB.' });
    const reader = new FileReader();
    reader.onload = () => sendMedia('IMAGE', String(reader.result), file.name);
    reader.readAsDataURL(file);
  };

  const toggleRecording = async () => {
    if (recording) return recorderRef.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.onload = () => sendMedia('AUDIO', String(reader.result), 'voice-note.webm');
        reader.readAsDataURL(blob);
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      notify({ title: 'Microphone unavailable', message: 'Allow microphone access to record a voice note.' });
    }
  };

  const lastActionMessage = [...messages].reverse().find(message => message.role === 'bot' && message.metadata?.action);
  const customerLocation = currentRequest?.userLatitude != null && currentRequest?.userLongitude != null
    ? { lat: Number(currentRequest.userLatitude), lon: Number(currentRequest.userLongitude) }
    : selectedLocation;

  return (
    <div className="chat-shell flex h-full min-h-0 bg-[var(--page)] text-[var(--text)]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col border-r border-[var(--border)] bg-[var(--panel)] transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[68px] items-center justify-between border-b border-[var(--border)] px-4">
          <div><p className="text-sm font-bold">Conversations</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">Your repair history</p></div>
          <div className="flex gap-1"><button onClick={handleNewChat} disabled={stopping || (sending && !sessionId)} className="grid h-9 w-9 place-items-center rounded-xl bg-blue-400 text-[#090e1d] transition hover:bg-blue-300" aria-label="New conversation"><MessageSquarePlus size={17} /></button><button onClick={() => setSidebarOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--muted)] lg:hidden" aria-label="Close history"><PanelLeftClose size={18} /></button></div>
        </div>
        <div className="chat-scroll flex-1 overflow-y-auto p-3">
          {sessions.length === 0 ? <div className="px-3 py-10 text-center"><History className="mx-auto mb-3 text-[var(--muted)]" size={22} /><p className="text-xs text-[var(--muted)]">Past chats will appear here.</p></div> : <div className="space-y-1.5">{sessions.map((s: any) => {
            const serviceKey = s.request?.serviceKey || s.request?.serviceType;
            const title = serviceKey ? (SERVICE_LABELS[serviceKey] || String(serviceKey).replaceAll('_', ' ')) : 'Home repair chat';
            const preview = s.messages?.[0]?.content || 'New conversation';
            return <button key={s.id} onClick={() => openHistory(s.id)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${sessionId === s.id ? 'border-blue-300/20 bg-blue-300/[.08]' : 'border-transparent hover:bg-[var(--soft)]'}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold text-[var(--text)]">{title}</p>{s.request?.status && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />}</div><p className="mt-1 truncate text-[11px] text-[var(--muted)]">{preview}</p></button>;
          })}</div>}
        </div>
        <div className="mt-auto border-t border-[var(--border)] p-3"><p className="mb-2 truncate px-3 text-xs text-[var(--muted)]">{user?.name}</p><LogoutButton className="w-full" /></div>
      </aside>

      {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close history" />}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] lg:hidden" aria-label="Open history"><Menu size={18} /></button>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-300/10 text-[var(--brand)]"><Sparkles size={17} /></span>
          <div><h1 className="text-sm font-bold">FixBot assistant</h1><p className="text-[11px] text-[var(--brand)]">Online · usually replies instantly</p></div>

          {currentRequest && <span className="ml-auto rounded-full border border-blue-300/15 bg-blue-300/[.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">{String(currentRequest.status).replaceAll('_', ' ')}</span>}
          {currentRequest?.status && !['SEARCHING', 'ASSIGNED', 'REJECTED', 'CANCELLED'].includes(currentRequest.status) && <button onClick={() => setCallOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500 text-white" aria-label="Start private in-app call"><Phone size={16}/></button>}

        </header>

        {pendingSearch && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2">
          <p className="text-xs text-[var(--muted)]">{currentRequest?.status === 'ASSIGNED' ? 'Waiting for the professional to accept' : 'Finding a professional'}</p>
          <button type="button" disabled={stopping || !sessionId} onClick={() => { setStopError(''); setStopIntent({ kind: 'stop' }); }} className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--danger)] disabled:opacity-50">{stopping ? 'Stopping...' : currentRequest?.status === 'ASSIGNED' ? 'Cancel request' : 'Stop searching'}</button>
        </div>}
        {currentRequest?.status === 'ACCEPTED' && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2"><Link href={`/tracking/${currentRequest.id}`} className="min-h-11 content-center text-sm font-semibold text-[var(--brand)]">Track professional</Link><CancelRequestButton request={currentRequest} onCancelled={async () => { setOutstandingBooking(null); if (sessionId) await dispatch(loadSession(sessionId)); dispatch(fetchSessions()); }} /></div>}
        {currentRequest?.worker && !['CANCELLED', 'REJECTED', 'PAID'].includes(currentRequest.status) && <div className="shrink-0 border-b border-[var(--border)] px-4 py-2"><SafetyShortcuts /></div>}
        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8">
            {['ACCEPTED','IN_PROGRESS'].includes(currentRequest?.status) && !workerLocation && <p className="mb-4 text-xs text-[var(--muted)]">Waiting for the professional to share their live location.</p>}
            {workerLocation && customerLocation && <div className="mb-6"><LiveTrackingMap worker={workerLocation} customer={customerLocation} workerName={currentRequest?.worker?.user?.name} updatedAt={workerLocation.updatedAt} accuracy={workerLocation.accuracy}/></div>}
            {loading ? <div className="space-y-4"><div className="h-16 w-3/5 rounded-2xl shimmer" /><div className="ml-auto h-14 w-1/2 rounded-2xl shimmer" /></div> : messages.length === 0 ? <div className="my-auto py-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-blue-300/15 bg-blue-300/[.08] text-[var(--brand)]"><Sparkles size={24} /></span><h2 className="mt-5 font-display text-2xl font-bold tracking-[-.03em]">What needs fixing?</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Describe the problem in your own words. I’ll understand the service you need and guide you from there.</p><div className="mx-auto mt-7 grid max-w-lg grid-cols-2 gap-2">{QUICK_PROMPTS.map(p => <button key={p.text} onClick={() => submitMessage(p.text)} className="rounded-xl border border-[var(--border)] bg-[var(--soft)] px-3 py-3 text-xs font-medium text-[var(--text)] transition hover:border-blue-300/20 hover:bg-blue-300/[.06] hover:text-[var(--text)]">{p.label}</button>)}</div></div> : <div className="space-y-5">{messages.map(msg => <MessageBubble key={msg.id} {...msg} onAction={sending || msg.id !== lastActionMessage?.id ? undefined : (msg.metadata?.action === 'PRICE_APPROVAL' ? (chatState === 'AWAITING_PRICE' ? handleAction : undefined) : ['CHOOSE_WORKER','SHARE_ISSUE'].includes(msg.metadata?.action) ? (chatState === 'CHOOSE_WORKER' ? handleAction : undefined) : msg.metadata?.action === 'CONFIRM_SERVICE' ? (chatState === 'ISSUE_CAPTURED' ? handleAction : undefined) : handleAction)} />)}{sending && <TypingIndicator />}{error && !sending && <p className="text-center text-xs text-rose-300/80">{error}</p>}</div>}
          {chatState === 'CHOOSE_WORKER' && <div ref={safetyRef} className="mt-5"><HomeSafetyNotice checked={safetyAcknowledged} onChange={value => { setSafetyAcknowledged(value); setSafetyError(''); }} error={safetyError}/></div>}
          {outstandingBooking && outstandingBooking.id !== currentRequest?.id && <p className="mx-auto mb-3 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">Finish or close your current booking before requesting another service. <a href="/dashboard" className="font-bold underline">View my bookings</a></p>}
          {chatState === 'NEED_LOCATION' && !sending && !loading && <div className="mx-auto mt-5 mb-3 w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-3 text-[var(--text)]"><LocationPicker onChange={location => {setSelectedLocation({lat:location.latitude,lon:location.longitude});submitMessage(`${location.latitude}, ${location.longitude} | ${location.address}`, location.address);}} /></div>}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel)] px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          {isClosed ? <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">This request is closed. No search is running.</p><button type="button" disabled={restarting} onClick={findAnother} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{restarting ? 'Starting...' : 'Find another professional'}</button></div> : <>
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--soft)] p-2 shadow-[0_12px_40px_rgba(0,0,0,.12)] focus-within:border-blue-400">
            {currentRequest?.id && ['SEARCHING', 'ASSIGNED'].includes(chatState) && currentRequest?.status !== 'AWAITING_APPROVAL' ? <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { pickImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              <button onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--brand)]" aria-label="Send an issue image"><ImagePlus size={18}/></button>
              <button onClick={toggleRecording} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${recording ? 'bg-rose-500 text-white' : 'text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--brand)]'}`} aria-label={recording ? 'Stop voice recording' : 'Record a voice note'}>{recording ? <Square size={15} fill="currentColor"/> : <Mic size={18}/>}</button>
            </> : <button onClick={shareLocation} disabled={locating || sending || chatState !== 'NEED_LOCATION'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--brand)] disabled:opacity-40" aria-label="Share current location"><MapPin size={18} className={locating ? 'animate-pulse' : ''} /></button>}
            <textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value.slice(0, 600))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage(input); } }} placeholder="Describe what needs fixing…" className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]" aria-label="Message FixBot" />
            <button onClick={() => submitMessage(input)} disabled={!input.trim() || sending} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-400 text-[#090e1d] transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:bg-[var(--soft)] disabled:text-[var(--muted)]" aria-label="Send message"><ArrowUp size={18} strokeWidth={2.5} /></button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-[var(--muted)]">Zoon uses your details only to arrange your service.</p></>}
        </div>
      </section>

      {stopIntent && <ConfirmDialog title={currentRequest?.status === 'ASSIGNED' ? 'Cancel this request?' : 'Stop searching?'} confirmLabel={currentRequest?.status === 'ASSIGNED' ? 'Cancel request' : 'Stop searching'} busy={stopping || !sessionId} error={stopError} onCancel={() => setStopIntent(null)} onConfirm={confirmStop}><p>{stopIntent.kind === 'stop' ? 'We will stop this search. A new search starts only when you choose Find another professional.' : 'Stop the current search before leaving this conversation?'}</p></ConfirmDialog>}
      {paymentData && <PaymentModal requestId={paymentData.requestId} amount={paymentData.amount} onSuccess={() => { setPaymentData(null); setOutstandingBooking(null); if (sessionId) dispatch(loadSession(sessionId)); dispatch(fetchSessions()); }} onClose={() => setPaymentData(null)} />}
      {ratingData && <RatingModal requestId={ratingData.requestId} onSuccess={() => { setRatingData(null); if (sessionId) dispatch(loadSession(sessionId)); dispatch(fetchSessions()); }} onClose={() => setRatingData(null)} />}
      {callOpen && <InAppCallModal name={currentRequest?.worker?.user?.name || 'Your professional'} onClose={() => setCallOpen(false)} />}
    </div>
  );
}
