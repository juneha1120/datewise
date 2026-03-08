'use client';

import Link from 'next/link';
import { clearSession, readSession } from '../lib/auth';
import { useEffect, useState } from 'react';

export function Nav() {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => setLoggedIn(Boolean(readSession()?.accessToken)), []);

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-800 p-4">
      <Link href="/login">Login</Link>
      <Link href="/planner">Planner</Link>
      <Link href="/profile">Profile</Link>
      <Link href="/public">Public</Link>
      {loggedIn && (
        <button
          onClick={() => {
            clearSession();
            location.href = '/login';
          }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}
