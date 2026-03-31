'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiBaseUrl, readSession } from '../../lib/auth';

type SavedCopy = {
  id: string;
  sourceItineraryId: string;
  createdAt: string;
  snapshot: {
    id: string;
    result: Array<{ place: { name: string }; subgroup: string }>;
  };
};

export default function SavedPage() {
  const [items, setItems] = useState<SavedCopy[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const token = readSession()?.accessToken;
      if (!token) {
        setError('Please login to view your saved public copies.');
        return;
      }

      const response = await fetch(`${apiBaseUrl()}/itineraries/saved/mine`, {
        headers: { authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        setError(text || 'Failed to load saved copies.');
        return;
      }

      setItems((await response.json()) as SavedCopy[]);
    }

    void load();
  }, []);

  return (
    <main className="page-stack">
      <section className="hero hero-compact">
        <p className="eyebrow">Saved itineraries</p>
        <h1 className="page-title">Saved public snapshots.</h1>
        <p className="lede">Quick access to copied public routes.</p>
        <div className="actions">
          <Link href="/profile" className="button-primary">Open profile</Link>
          <Link href="/public" className="button-secondary">Browse public itineraries</Link>
        </div>
        {error && <p className="status-message error">{error}</p>}
      </section>

      <section className="cards-grid">
        {items.length === 0 ? (
          <div className="empty-state">No saved public copies yet.</div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Saved copy</p>
                  <h2 className="card-title">Snapshot {item.snapshot.id.slice(0, 8)}</h2>
                </div>
                <span className="status-pill">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="muted-line">Source {item.sourceItineraryId.slice(0, 8)}</p>
              <div className="plain-list">
                {item.snapshot.result.map((slot, idx) => (
                  <div key={`${slot.place.name}-${idx}`} className="simple-row">
                    <strong>{idx + 1}. {slot.place.name}</strong>
                    <p className="helper">{slot.subgroup}</p>
                  </div>
                ))}
              </div>

              <Link href={`/itinerary/${item.id}`} className="button-ghost">Open detail</Link>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
