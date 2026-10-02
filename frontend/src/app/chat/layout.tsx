import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a service | Zoon',
  description: 'Describe your home repair and get matched with a trusted professional.',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
