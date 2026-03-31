import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link href="/" className="brand">
              <span className="brand-mark">D</span>
              <span className="brand-copy">
                <strong>Datewise</strong>
                <p className="helper">Singapore date planning, minus the tab overload.</p>
              </span>
            </Link>

            <nav className="topnav" aria-label="Primary">
              <Link href="/planner" className="nav-link">Planner</Link>
              <Link href="/public" className="nav-link">Public</Link>
              <Link href="/saved" className="nav-link">Saved</Link>
              <Link href="/profile" className="nav-link">Profile</Link>
              <Link href="/login" className="nav-link">Login</Link>
            </nav>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
