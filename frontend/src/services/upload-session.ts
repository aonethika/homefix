let memorySession: string | null = null;
// A per-tab capability binds anonymous upload tickets to their registration.
// It is never an AWS credential and is never sent to S3.
export function getUploadSession() {
  if (memorySession) return memorySession;
  try { const saved = sessionStorage.getItem('zoon_upload_session'); if (saved && /^[a-f0-9]{64}$/.test(saved)) return (memorySession = saved); } catch {}
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  memorySession = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('zoon_upload_session', memorySession); } catch {}
  return memorySession;
}
