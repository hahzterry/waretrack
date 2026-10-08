import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: 'WareTrack',
  description: 'Real-time warehouse management with a live isometric yard view.',
};

export const viewport: Viewport = { themeColor: '#e8eef5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
