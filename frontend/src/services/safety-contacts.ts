// Kerala Police official contacts, verified 2026-09-30:
// https://keralapolice.gov.in/page/contacts
// https://kasaragod.keralapolice.gov.in/contacts/
// Only deploy overrides after verifying the supported region's official service.
const region = process.env.NEXT_PUBLIC_SAFETY_REGION || 'Kerala, India';
export const safetyContacts = [
  { name: "Women's Helpline", number: process.env.NEXT_PUBLIC_WOMENS_HELPLINE || '1091', region },
  { name: 'Police / Emergency', number: process.env.NEXT_PUBLIC_EMERGENCY_NUMBER || '112', region },
].filter(contact => /^\+?[0-9]{3,15}$/.test(contact.number));
