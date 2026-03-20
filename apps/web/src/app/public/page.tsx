'use client';

import { useState } from 'react';
import { apiBaseUrl, readSession } from '../../lib/auth';

type PublicItem = {
  id: string;
  createdAt: string;
  result: Array<{ place: { name: string }; subgroup: string }>;
};

export default function PublicPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [error, setError] = useState('');

  async function refresh() {
    const response = await fetch(`${apiBaseUrl()}/itineraries/public`);
    if (!response.ok) {
      const text = await response.text();
      return setError(`Failed to load public itineraries: ${text}`);
    }
    setItems((await response.json()) as PublicItem[]);
    setError('');
  }

  async function saveCopy(id: string) {
    const token = readSession()?.accessToken;
    if (!token) return setError('Please login first');

    const response = await fetch(`${apiBaseUrl()}/itineraries/public/${id}/save-copy`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      return setError(`Failed to save copy: ${text}`);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Public itineraries</h1>
      <button onClick={refresh}>Refresh</button>
      {error && <p className="text-rose-300">{error}</p>}

      {items.map((item) => (
        <article key={item.id} className="rounded border border-slate-700 p-3">
          <p className="font-semibold">Public itinerary {item.id.slice(0, 8)}</p>
          <p>{new Date(item.createdAt).toLocaleString()}</p>
          <ul>
            {item.result.map((slot, idx) => (
              <li key={`${slot.place.name}-${idx}`}>
                {idx + 1}. {slot.place.name} ({slot.subgroup})
              </li>
            ))}
          </ul>
          <button onClick={() => saveCopy(item.id)}>Save copy</button>
        </article>
      ))}
    </main>
  );
}
