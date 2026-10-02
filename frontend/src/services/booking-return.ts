export function bookingReturn() {
  if (typeof window === 'undefined') return '/chat';
  const next = new URLSearchParams(window.location.search).get('next') || '';
  return /^\/(book|bookings)\/[a-zA-Z0-9-]+$/.test(next) ? next : '/chat';
}
