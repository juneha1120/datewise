import './globals.css';
import type { ReactNode } from 'react';
import { Nav } from '../components/nav';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}
