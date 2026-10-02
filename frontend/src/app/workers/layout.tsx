import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trusted professionals | Zoon',
  description: 'Browse verified Zoon service professionals.',
};

export default function WorkersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
