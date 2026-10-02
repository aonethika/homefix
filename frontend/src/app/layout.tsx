import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Zoon — Home repairs, handled',
  description: 'Book trusted plumbers, electricians, AC technicians, and carpenters through one simple conversation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){var saved;try{saved=localStorage.getItem('Zoon_theme')}catch(e){}document.documentElement.dataset.theme=saved==='dark'||(saved!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'})();` }}/></head><body className="antialiased"><Providers>{children}</Providers></body></html>;
}
