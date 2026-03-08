'use client';

import { useState } from 'react';
import { readSession } from '../../lib/auth';

type PublicItem = { id: string; title: string; createdAt: string; slots: Array<{ placeName: string }> };

export default function PublicPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [error, setError] = useState('');

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Public itineraries</h1>
      <button
        onClick={async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/public`);
          if (!response.ok) return setError('Failed to load public itineraries');
          setItems((await response.json()) as PublicItem[]);
          setError('');
        }}
      >
        Refresh
      </button>
      {error && <p className="text-rose-300">{error}</p>}
      {items.map((item) => (
        <article key={item.id} className="rounded border border-slate-700 p-3">
          <p className="font-semibold">{item.title}</p>
          <p>{item.slots.length} slots</p>
          <button
            onClick={async () => {
              const token = readSession()?.accessToken;
              if (!token) return setError('Please login first');
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/public/${item.id}/save-copy`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
              if (!response.ok) return setError('Failed to save copy');
            }}
          >
            Save copy
          </button>
        </article>
      ))}
    </main>
  );
}
