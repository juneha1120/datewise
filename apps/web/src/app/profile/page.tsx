'use client';

import { useState } from 'react';
import { readSession } from '../../lib/auth';

type ProfileResponse = { user: { displayName: string; email: string }; itineraries: Array<{ id: string; title: string }>; saved: Array<{ id: string; sourceItineraryId: string }> };

export default function ProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState('');

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Profile</h1>
      <button
        onClick={async () => {
          const token = readSession()?.accessToken;
          if (!token) return setError('Please login first');
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/profile`, { headers: { authorization: `Bearer ${token}` } });
          if (!response.ok) return setError('Failed to load profile');
          setData((await response.json()) as ProfileResponse);
          setError('');
        }}
      >
        Load profile
      </button>
      {error && <p className="text-rose-300">{error}</p>}
      {data && (
        <section className="space-y-2">
          <p>{data.user.displayName} · {data.user.email}</p>
          <p>Own itineraries: {data.itineraries.length}</p>
          <p>Saved itineraries: {data.saved.length}</p>
        </section>
      )}
    </main>
  );
}
