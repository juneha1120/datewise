'use client';

import { useState } from 'react';
import { readSession } from '../../lib/auth';

type User = { id: string; email: string; displayName: string; profileImage: string | null };
type Itinerary = { id: string; title: string; createdAt: string; isPublic: boolean; slots: Array<{ placeName: string }> };
type Saved = { id: string; sourceItineraryId: string; createdAt: string; snapshot: { title: string } };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [mine, setMine] = useState<Itinerary[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const token = readSession()?.accessToken;
    if (!token) return setError('Please login first');

    const headers = { authorization: `Bearer ${token}` };
    const [meResponse, mineResponse, savedResponse] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/mine`, { headers }),
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/saved/mine`, { headers }),
    ]);

    if (!meResponse.ok || !mineResponse.ok || !savedResponse.ok) return setError('Failed to load profile data');

    setUser((await meResponse.json()) as User);
    setMine((await mineResponse.json()) as Itinerary[]);
    setSaved((await savedResponse.json()) as Saved[]);
    setError('');
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Profile</h1>
      <button onClick={load}>Refresh profile data</button>
      {error && <p className="text-rose-300">{error}</p>}

      {!user ? (
        <p className="text-slate-400">No profile loaded.</p>
      ) : (
        <section className="space-y-2 rounded border border-slate-700 p-3">
          <p className="font-semibold">{user.displayName}</p>
          <p>{user.email}</p>
        </section>
      )}

      <section className="space-y-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">My itineraries ({mine.length})</h2>
        {mine.map((item) => (
          <article key={item.id} className="rounded border border-slate-700 p-3">
            <p>{item.title}</p>
            <p>{item.isPublic ? 'Public' : 'Private'} · {item.slots.length} slots</p>
          </article>
        ))}
      </section>

      <section className="space-y-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Saved public copies ({saved.length})</h2>
        {saved.map((item) => (
          <article key={item.id} className="rounded border border-slate-700 p-3">
            <p>{item.snapshot.title}</p>
            <p>Saved copy of itinerary {item.sourceItineraryId}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
