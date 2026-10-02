import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trusted professionals | zoon',
  description: 'Browse verified zoon service professionals.',
};

export default function WorkersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
