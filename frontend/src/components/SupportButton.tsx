'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { LifeBuoy, X } from 'lucide-react';
import { platformAPI } from '@/services/api';
import { notify } from './NotificationToast';
import type { RootState } from '@/store';
import { usePathname } from 'next/navigation';

export default function SupportButton({ inline = false }: { inline?: boolean }) {
  const user=useSelector((s:RootState)=>s.auth.user); const pathname=usePathname(); const [open,setOpen]=useState(false); const [subject,setSubject]=useState(''); const [message,setMessage]=useState(''); const [loading,setLoading]=useState(false);
  if(!user||user.role==='ADMIN'||pathname.startsWith('/admin'))return null;
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setLoading(true);try{await platformAPI.createComplaint({subject,message});notify({title:'Complaint received',message:'The admin team has been notified.',tone:'success'});setOpen(false);setSubject('');setMessage('');}catch(error:any){notify({title:'Could not send complaint',message:error.response?.data?.message||'Please try again.'});}finally{setLoading(false);}};
  return <><button onClick={()=>setOpen(true)} className={`${inline ? "relative" : "fixed bottom-5 left-5 z-[89]"} flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#D97757] to-[#c45f42] px-4 text-xs font-bold text-white shadow-xl`}><LifeBuoy size={17}/>Support</button>{open&&<div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={submit} className="support-portal-modal hf-panel w-full max-w-md rounded-[1.75rem] p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-bold text-[var(--text)]">Tell us what happened</h2><p className="mt-1 text-xs text-[var(--muted)]">Admins receive this immediately.</p></div><button type="button" onClick={()=>setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--soft)] text-[var(--muted)]"><X size={17}/></button></div><div className="mt-6 space-y-4"><input required className="hf-input" placeholder="Short subject" value={subject} onChange={e=>setSubject(e.target.value)}/><textarea required rows={5} className="hf-input h-auto resize-none" placeholder="Describe your concern or complaint" value={message} onChange={e=>setMessage(e.target.value)}/><button disabled={loading} className="hf-primary w-full px-4 py-3">{loading?'Sending…':'Send to Zoon support'}</button></div></form></div>}</>;
}
