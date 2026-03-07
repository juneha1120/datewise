'use client';

import { useMemo, useState } from 'react';
import { CORE_GROUPS, SUBGROUPS, type SlotSelection } from '../../../../packages/shared/src/index';

type PlanSlot = { selection: SlotSelection; placeName: string; travelMinutes: number; startOffsetMin: number; durationMin: number; subgroup: string };

const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotSelection[];

export function DatewiseApp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [start, setStart] = useState('Marina Bay Sands');
  const [includeSlots, setIncludeSlots] = useState<SlotSelection[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotSelection[]>([]);
  const [result, setResult] = useState<PlanSlot[]>([]);
  const [error, setError] = useState('');

  const conflicts = useMemo(() => includeSlots.filter((slot) => avoidSlots.includes(slot)), [includeSlots, avoidSlots]);

  async function login() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!response.ok) return setError('Login failed');
    const data = (await response.json()) as { token: string };
    setToken(data.token);
    setError('');
  }

  async function generate() {
    if (conflicts.length > 0) return setError('Include slots cannot conflict with avoided slots');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        start: { label: start, lat: 1.2834, lng: 103.8607 },
        date: new Date().toISOString().slice(0, 10),
        time: '19:00',
        includeSlots,
        avoidSlots,
      }),
    });
    if (!response.ok) return setError('Generation failed');
    setResult((await response.json()) as PlanSlot[]);
    setError('');
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-4xl font-bold">Datewise</h1>
      <section className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Auth</h2>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={login}>Login</button>
      </section>
      <section className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Generator</h2>
        <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Start location" />
        <div className="grid grid-cols-2 gap-3">
          {includeSlots.map((slot, index) => (
            <select key={index} value={slot} onChange={(e) => setIncludeSlots((prev) => prev.map((entry, idx) => (idx === index ? (e.target.value as SlotSelection) : entry)))}>
              {allSelections.map((option) => <option key={option}>{option}</option>)}
            </select>
          ))}
        </div>
        <select onChange={(e) => setAvoidSlots((prev) => [...prev, e.target.value as SlotSelection])} defaultValue="">
          <option value="" disabled>Add avoided slot</option>
          {allSelections.map((option) => <option key={option}>{option}</option>)}
        </select>
        <button onClick={generate}>Generate</button>
        {error && <p className="text-rose-300">{error}</p>}
      </section>
      <section className="space-y-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xl font-semibold">Result</h2>
        {result.length === 0 ? <p className="text-slate-400">No itinerary generated yet.</p> : result.map((slot, index) => (
          <article key={index} className="rounded border border-slate-700 p-3">
            <p className="font-semibold">{index + 1}. {slot.placeName}</p>
            <p>{slot.subgroup} · travel {slot.travelMinutes} mins · stay {slot.durationMin} mins</p>
          </article>
        ))}
      </section>
    </main>
  );
}
