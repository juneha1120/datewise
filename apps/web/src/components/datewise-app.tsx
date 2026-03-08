'use client';

import { useMemo, useState } from 'react';
import { detectConflict, CORE_GROUPS, SUBGROUPS, type SlotSelection } from '../../../../packages/shared/src/index';

type PlanSlot = {
  slotIndex: number;
  selection: SlotSelection;
  placeName: string;
  travelMinutes: number;
  startOffsetMin: number;
  durationMin: number;
  subgroup: string;
  lat: number;
  lng: number;
};

type ItineraryRecord = { id: string; title: string; isPublic: boolean; createdAt: string; slots: PlanSlot[] };
const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotSelection[];

export function DatewiseApp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('Datewise User');
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState<{ user: { displayName: string; email: string }; itineraries: ItineraryRecord[]; saved: Array<{ id: string; snapshot: ItineraryRecord }> } | null>(null);

  const [start, setStart] = useState({ label: 'Marina Bay Sands', lat: 1.2834, lng: 103.8607 });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('19:00');
  const [includeSlots, setIncludeSlots] = useState<SlotSelection[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotSelection[]>([]);
  const [result, setResult] = useState<PlanSlot[]>([]);
  const [publicItineraries, setPublicItineraries] = useState<ItineraryRecord[]>([]);
  const [error, setError] = useState('');

  const conflicts = useMemo(() => detectConflict(includeSlots, avoidSlots), [includeSlots, avoidSlots]);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  async function signup() {
    const response = await fetch(`${apiBase}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, displayName }) });
    if (!response.ok) return setError('Signup failed');
    const data = (await response.json()) as { token: string };
    setToken(data.token);
    setError('');
  }

  async function login() {
    const response = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) return setError('Login failed');
    const data = (await response.json()) as { token: string };
    setToken(data.token);
    setError('');
    await loadProfile(data.token);
  }

  async function loginGoogleMock() {
    const response = await fetch(`${apiBase}/auth/google`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, displayName, profileImage: null }) });
    if (!response.ok) return setError('Google login failed');
    const data = (await response.json()) as { token: string };
    setToken(data.token);
    setError('');
    await loadProfile(data.token);
  }

  async function loadProfile(nextToken = token) {
    if (!nextToken) return;
    const response = await fetch(`${apiBase}/auth/profile`, { headers: { authorization: `Bearer ${nextToken}` } });
    if (!response.ok) return setError('Unable to load profile');
    setProfile((await response.json()) as typeof profile);
  }

  async function loadPublic() {
    const response = await fetch(`${apiBase}/itineraries/public`);
    if (!response.ok) return setError('Unable to load public itineraries');
    setPublicItineraries((await response.json()) as ItineraryRecord[]);
  }

  async function generate() {
    if (!token) return setError('Please login first');
    if (conflicts.length > 0) return setError('Include slots conflict with avoided selections');
    const response = await fetch(`${apiBase}/itineraries/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ start, date, time, includeSlots, avoidSlots }),
    });
    if (!response.ok) return setError('Generation failed');
    setResult((await response.json()) as PlanSlot[]);
    setError('');
  }

  async function regenerateSlot(slotIndex: number) {
    const response = await fetch(`${apiBase}/itineraries/regenerate-slot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ start, date, time, includeSlots, avoidSlots, slotIndex, existingPlaceNames: result.map((slot) => slot.placeName) }),
    });
    if (!response.ok) return setError('Regenerate slot failed');
    const updated = (await response.json()) as PlanSlot;
    setResult((prev) => prev.map((slot, idx) => (idx === slotIndex ? updated : slot)));
  }

  async function save(isPublic: boolean) {
    const response = await fetch(`${apiBase}/itineraries/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ input: { start, date, time, includeSlots, avoidSlots }, isPublic }),
    });
    if (!response.ok) return setError('Save failed');
    await loadProfile();
    await loadPublic();
  }

  async function savePublicCopy(id: string) {
    const response = await fetch(`${apiBase}/itineraries/public/${id}/save-copy`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return setError('Save public copy failed');
    await loadProfile();
  }

  function reorder(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= includeSlots.length) return;
    setIncludeSlots((prev) => {
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  function addSlot() {
    if (includeSlots.length >= 4) return;
    setIncludeSlots((prev) => [...prev, 'DO']);
  }

  function removeSlot(index: number) {
    if (includeSlots.length <= 2) return;
    setIncludeSlots((prev) => prev.filter((_, idx) => idx !== index));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return setError('Geolocation unavailable');
    navigator.geolocation.getCurrentPosition(
      (position) => setStart({ label: 'Current location', lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setError('Failed to read current location'),
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-4xl font-bold">Datewise</h1>
      <section className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Authentication</h2>
        <input placeholder="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="flex gap-2">
          <button onClick={signup}>Sign up</button>
          <button onClick={login}>Login</button>
          <button onClick={loginGoogleMock}>Google login</button>
          <button onClick={() => loadProfile()}>Load profile</button>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Generator</h2>
        <input value={start.label} onChange={(event) => setStart((prev) => ({ ...prev, label: event.target.value }))} placeholder="Start location" />
        <div className="flex gap-2">
          <button onClick={useCurrentLocation}>Use current location</button>
          <button onClick={() => setStart({ label: 'Orchard Road', lat: 1.3048, lng: 103.8318 })}>Use Orchard preset</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Included slots ({includeSlots.length}/4)</h3>
          {includeSlots.map((slot, index) => (
            <div key={`${slot}-${index}`} className="flex gap-2">
              <select value={slot} onChange={(event) => setIncludeSlots((prev) => prev.map((entry, idx) => (idx === index ? (event.target.value as SlotSelection) : entry)))}>
                {allSelections.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <button onClick={() => reorder(index, -1)}>↑</button>
              <button onClick={() => reorder(index, 1)}>↓</button>
              <button onClick={() => removeSlot(index)}>Remove</button>
            </div>
          ))}
          <button onClick={addSlot}>Add slot</button>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Avoided slots</h3>
          <select onChange={(event) => setAvoidSlots((prev) => [...prev, event.target.value as SlotSelection])} defaultValue="">
            <option value="" disabled>
              Add avoided slot
            </option>
            {allSelections.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {avoidSlots.map((entry, index) => (
              <button key={`${entry}-${index}`} onClick={() => setAvoidSlots((prev) => prev.filter((_, idx) => idx !== index))}>
                {entry} ×
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={generate}>Generate itinerary</button>
          <button onClick={() => save(false)}>Save private</button>
          <button onClick={() => save(true)}>Save public</button>
        </div>
        {conflicts.length > 0 && <p className="text-amber-300">Conflicts: {conflicts.join(', ')}</p>}
        {error && <p className="text-rose-300">{error}</p>}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Generated itinerary</h2>
        {result.length === 0 ? (
          <p className="text-slate-400">No itinerary generated yet.</p>
        ) : (
          result.map((slot, index) => (
            <article key={`${slot.placeName}-${index}`} className="rounded border border-slate-700 p-3">
              <p className="font-semibold">
                {index + 1}. {slot.placeName}
              </p>
              <p>
                {slot.subgroup} · travel {slot.travelMinutes} mins · arrive +{slot.startOffsetMin} mins · stay {slot.durationMin} mins
              </p>
              <button onClick={() => regenerateSlot(index)}>Regenerate this slot</button>
            </article>
          ))
        )}
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Profile & saved itineraries</h2>
        {!profile ? <p className="text-slate-400">No profile loaded.</p> : (
          <>
            <p>{profile.user.displayName} · {profile.user.email}</p>
            <p>Own itineraries: {profile.itineraries.length}</p>
            <p>Saved public copies: {profile.saved.length}</p>
          </>
        )}
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Public itineraries</h2>
        <button onClick={loadPublic}>Refresh public feed</button>
        {publicItineraries.length === 0 ? <p className="text-slate-400">No public itineraries yet.</p> : publicItineraries.map((entry) => (
          <article key={entry.id} className="rounded border border-slate-700 p-3">
            <p className="font-semibold">{entry.title}</p>
            <p>{entry.slots.length} slots · {new Date(entry.createdAt).toLocaleString()}</p>
            <button onClick={() => savePublicCopy(entry.id)}>Save to my account</button>
          </article>
        ))}
      </section>
    </main>
  );
}
