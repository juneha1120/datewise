'use client';

import { useState } from 'react';
import { readSession } from '../../lib/auth';

type PublicItem = {
  id: string;
  title: string;
  createdAt: string;
  slots: Array<{ placeName: string; subgroup: string }>;
};

export default function PublicPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function refresh() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/public`);
    if (!response.ok) return setError('Failed to load public itineraries');
    setItems((await response.json()) as PublicItem[]);
    setError('');
  }

  async function saveCopy(id: string) {
    const token = readSession()?.accessToken;
    if (!token) return setError('Please login first');

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/public/${id}/save-copy`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) return setError('Failed to save copy');
    setError('');
    setInfo('Saved a copy to your account.');
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Public itineraries</h1>
      <button onClick={refresh}>Refresh</button>
      {error && <p className="text-rose-300">{error}</p>}
      {info && <p className="text-emerald-300">{info}</p>}

      {items.length === 0 ? (
        <p className="text-slate-400">No public itineraries loaded.</p>
      ) : (
        items.map((item) => (
          <article key={item.id} className="rounded border border-slate-700 p-3">
            <p className="font-semibold">{item.title}</p>
            <p>{new Date(item.createdAt).toLocaleString()}</p>
            <ul>
              {item.slots.map((slot, idx) => (
                <li key={`${slot.placeName}-${idx}`}>
                  {idx + 1}. {slot.placeName} ({slot.subgroup})
                </li>
              ))}
            </ul>
            <button onClick={() => saveCopy(item.id)}>Save copy</button>
          </article>
        ))
      )}
    </main>
  );
}
