'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiBaseUrl, readSession } from '../../lib/auth';

type PublicItem = {
  id: string;
  createdAt: string;
  input: { startPoint: { name: string }; slots: string[] };
  result: Array<{ place: { name: string }; subgroup: string }>;
};

export default function PublicPage() {
  const [items, setItems] = useState<PublicItem[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl()}/itineraries/public`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to load public itineraries');
      }
      setItems((await response.json()) as PublicItem[]);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load public itineraries');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveCopy(id: string) {
    const token = readSession()?.accessToken;
    if (!token) {
      setError('Please login first');
      return;
    }

    const response = await fetch(`${apiBaseUrl()}/itineraries/public/${id}/save-copy`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      setError(`Failed to save copy: ${text}`);
      return;
    }

    setInfo('Saved a copy to your account.');
    setError('');
  }

  return (
    <main className="cards-grid">
      <section className="hero">
        <p className="eyebrow">Public itineraries</p>
        <h1 className="page-title">Browse routes other people decided were worth sharing.</h1>
        <p className="lede">Public itineraries are visible to everyone. Logged-in users can save a snapshot copy into their own profile.</p>
        <div className="actions">
          <button className="button-primary" onClick={refresh} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh list'}</button>
          <Link href="/planner" className="button-secondary">Build your own</Link>
        </div>
        {error && <p className="status-message error">{error}</p>}
        {info && <p className="status-message success">{info}</p>}
      </section>

      <section className="cards-grid">
        {items.length === 0 ? (
          <div className="empty-state">No public itineraries yet. Publish one from the planner after generating a route.</div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Public route</p>
                  <h2 className="card-title">Start near {item.input.startPoint.name}</h2>
                </div>
                <span className="status-pill">{new Date(item.createdAt).toLocaleString()}</span>
              </div>

              <p className="helper">Requested slots: {item.input.slots.join(', ')}</p>
              <div className="plain-list">
                {item.result.map((slot, idx) => (
                  <div key={`${slot.place.name}-${idx}`} className="simple-row">
                    <strong>{idx + 1}. {slot.place.name}</strong>
                    <p className="helper">{slot.subgroup}</p>
                  </div>
                ))}
              </div>

              <div className="actions">
                <Link href={`/itinerary/${item.id}`} className="button-ghost">Open detail</Link>
                <button className="button-secondary" onClick={() => saveCopy(item.id)}>Save copy</button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
