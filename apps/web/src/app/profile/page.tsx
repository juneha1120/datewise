'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiBaseUrl, clearSession, readSession } from '../../lib/auth';

type User = { id: string; email: string; displayName: string; profileImage: string | null };
type Itinerary = { id: string; createdAt: string; isPublic: boolean; input: { startPoint: { name: string } }; result: Array<{ place: { name: string } }> };
type Saved = { id: string; sourceItineraryId: string; createdAt: string; snapshot: { id: string; result: Array<{ place: { name: string } }> } };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [mine, setMine] = useState<Itinerary[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function load() {
    const token = readSession()?.accessToken;
    if (!token) {
      setError('Please login first');
      return;
    }

    const headers = { authorization: `Bearer ${token}` };
    const [meResponse, mineResponse, savedResponse] = await Promise.all([
      fetch(`${apiBaseUrl()}/auth/me`, { headers }),
      fetch(`${apiBaseUrl()}/itineraries/mine`, { headers }),
      fetch(`${apiBaseUrl()}/itineraries/saved/mine`, { headers }),
    ]);

    if (!meResponse.ok || !mineResponse.ok || !savedResponse.ok) {
      setError('Failed to load profile data');
      return;
    }

    const nextUser = (await meResponse.json()) as User;
    setUser(nextUser);
    setDisplayName(nextUser.displayName);
    setMine((await mineResponse.json()) as Itinerary[]);
    setSaved((await savedResponse.json()) as Saved[]);
    setError('');
    setInfo('Profile refreshed.');
  }

  async function saveDisplayName() {
    const token = readSession()?.accessToken;
    if (!token) {
      setError('Please login first');
      return;
    }

    const response = await fetch(`${apiBaseUrl()}/auth/display-name`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const text = await response.text();
      setError(`Failed to save username: ${text}`);
      return;
    }

    setUser((await response.json()) as User);
    setError('');
    setInfo('Display name updated.');
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <section className="hero hero-compact">
        <p className="eyebrow">Profile</p>
        <h1 className="page-title">Your account and saved routes.</h1>
        <p className="lede">Review saved itineraries, copied routes, and account details.</p>
        <div className="actions">
          <button className="button-primary" onClick={load}>Refresh profile data</button>
          <button
            className="button-secondary"
            onClick={() => {
              clearSession();
              window.location.href = '/login';
            }}
          >
            Log out
          </button>
        </div>
        {error && <p className="status-message error">{error}</p>}
        {info && <p className="status-message success">{info}</p>}
      </section>

      {user && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h2 className="section-title">{user.displayName}</h2>
            </div>
          </div>
          <div className="form-grid">
            <p className="helper">{user.email}</p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="display-name">Display name</label>
                <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Username" />
              </div>
              <div className="field">
                <label>&nbsp;</label>
                <button className="button-secondary" onClick={saveDisplayName}>Save display name</button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid-2">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Private and public</p>
              <h2 className="section-title">My itineraries ({mine.length})</h2>
            </div>
            <Link href="/planner" className="button-ghost">Create another</Link>
          </div>

          {mine.length === 0 ? (
            <div className="empty-state">No itineraries saved yet.</div>
          ) : (
            <div className="plain-list">
              {mine.map((item) => (
                <article key={item.id} className="simple-row">
                  <div className="simple-row-top">
                    <strong>{item.input.startPoint.name}</strong>
                    <span className="status-pill">{item.isPublic ? 'Public' : 'Private'}</span>
                  </div>
                  <p className="muted-line">{item.result.length} stops · {new Date(item.createdAt).toLocaleDateString()}</p>
                  <Link href={`/itinerary/${item.id}`} className="button-ghost">Open detail</Link>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Copied from public</p>
              <h2 className="section-title">Saved copies ({saved.length})</h2>
            </div>
            <Link href="/saved" className="button-ghost">Open saved page</Link>
          </div>

          {saved.length === 0 ? (
            <div className="empty-state">No saved public copies yet.</div>
          ) : (
            <div className="plain-list">
              {saved.map((item) => (
                <article key={item.id} className="simple-row">
                  <div className="simple-row-top">
                    <strong>{item.snapshot.id.slice(0, 8)}</strong>
                    <span className="status-pill">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="muted-line">{item.snapshot.result.length} stops · source {item.sourceItineraryId.slice(0, 8)}</p>
                  <Link href={`/itinerary/${item.id}`} className="button-ghost">Open detail</Link>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
