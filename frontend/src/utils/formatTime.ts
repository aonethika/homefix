export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRelative(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(date);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export const SERVICE_LABELS: Record<string, string> = {
  PLUMBER: 'Plumber',
  ELECTRICIAN: 'Electrician',
  AC_TECHNICIAN: 'AC Technician',
  CARPENTER: 'Carpenter',
};

export const SERVICE_EMOJIS: Record<string, string> = {
  PLUMBER: '🔧',
  ELECTRICIAN: '⚡',
  AC_TECHNICIAN: '❄️',
  CARPENTER: '🪵',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  SEARCHING: 'Searching',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In Progress',
  PRICE_SET: 'Price Set',
  AWAITING_APPROVAL: 'Awaiting Approval',
  PAYMENT_PENDING: 'Payment Pending',
  PAID: 'Paid',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-400/10',
  SEARCHING: 'text-blue-400 bg-blue-400/10',
  ASSIGNED: 'text-purple-400 bg-purple-400/10',
  ACCEPTED: 'text-cyan-400 bg-cyan-400/10',
  IN_PROGRESS: 'text-orange-400 bg-orange-400/10',
  AWAITING_APPROVAL: 'text-amber-400 bg-amber-400/10',
  PAYMENT_PENDING: 'text-pink-400 bg-pink-400/10',
  PAID: 'text-green-400 bg-green-400/10',
  COMPLETED: 'text-emerald-400 bg-emerald-400/10',
  CANCELLED: 'text-red-400 bg-red-400/10',
  REJECTED: 'text-red-500 bg-red-500/10',
};
