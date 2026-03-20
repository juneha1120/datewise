'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readSession } from '../../lib/auth';

export default function SavedPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!readSession()?.accessToken) {
      location.href = '/login?next=/saved';
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <p className="text-slate-300">Redirecting to login...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Saved Itineraries</h1>
      <p>Use the Profile page to load your saved and generated itineraries.</p>
      <Link href="/profile">Go to profile</Link>
    </main>
  );
}
