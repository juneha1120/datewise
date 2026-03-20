'use client';

import { useState } from 'react';
import { apiBaseUrl, readSession } from '../../lib/auth';

type User = { id: string; email: string; displayName: string; profileImage: string | null };
type Itinerary = { id: string; createdAt: string; isPublic: boolean; result: Array<{ place: { name: string } }> };
type Saved = { id: string; sourceItineraryId: string; createdAt: string; snapshot: { id: string } };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [mine, setMine] = useState<Itinerary[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const token = readSession()?.accessToken;
    if (!token) return setError('Please login first');

    const headers = { authorization: `Bearer ${token}` };
    const [meResponse, mineResponse, savedResponse] = await Promise.all([
      fetch(`${apiBaseUrl()}/auth/me`, { headers }),
      fetch(`${apiBaseUrl()}/itineraries/mine`, { headers }),
      fetch(`${apiBaseUrl()}/itineraries/saved/mine`, { headers }),
    ]);

    if (!meResponse.ok || !mineResponse.ok || !savedResponse.ok) return setError('Failed to load profile data');

    const nextUser = (await meResponse.json()) as User;
    setUser(nextUser);
    setDisplayName(nextUser.displayName);
    setMine((await mineResponse.json()) as Itinerary[]);
    setSaved((await savedResponse.json()) as Saved[]);
    setError('');
  }

  async function saveDisplayName() {
    const token = readSession()?.accessToken;
    if (!token) return setError('Please login first');

    const response = await fetch(`${apiBaseUrl()}/auth/display-name`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const text = await response.text();
      return setError(`Failed to save username: ${text}`);
    }

    setUser((await response.json()) as User);
    setError('');
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Profile</h1>
      <button onClick={load}>Refresh profile data</button>
      {error && <p className="text-rose-300">{error}</p>}

      {user && (
        <section className="space-y-2 rounded border border-slate-700 p-3">
          <p>{user.email}</p>
          <div className="flex gap-2">
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Username" />
            <button onClick={saveDisplayName}>Save username</button>
          </div>
        </section>
      )}

      <section className="space-y-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">My itineraries ({mine.length})</h2>
        {mine.map((item) => (
          <article key={item.id} className="rounded border border-slate-700 p-3">
            <p>{item.id}</p>
            <p>{item.isPublic ? 'Public' : 'Private'} · {item.result.length} slots</p>
          </article>
        ))}
      </section>

      <section className="space-y-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Saved public copies ({saved.length})</h2>
        {saved.map((item) => (
          <article key={item.id} className="rounded border border-slate-700 p-3">
            <p>{item.snapshot.id}</p>
            <p>Saved copy of itinerary {item.sourceItineraryId}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
