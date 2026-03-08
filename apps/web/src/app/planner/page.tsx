'use client';

import { useMemo, useState } from 'react';
import { detectConflict, CORE_GROUPS, SUBGROUPS, type SlotSelection } from '../../../../../packages/shared/src/index';
import { readSession } from '../../lib/auth';

type PlanSlot = { slotIndex: number; selection: SlotSelection; placeName: string; travelMinutes: number; startOffsetMin: number; durationMin: number; subgroup: string };
const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotSelection[];

export default function PlannerPage() {
  const [start, setStart] = useState({ label: 'Marina Bay Sands', lat: 1.2834, lng: 103.8607 });
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('19:00');
  const [includeSlots, setIncludeSlots] = useState<SlotSelection[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotSelection[]>([]);
  const [result, setResult] = useState<PlanSlot[]>([]);
  const [error, setError] = useState('');
  const conflicts = useMemo(() => detectConflict(includeSlots, avoidSlots), [includeSlots, avoidSlots]);

  const token = readSession()?.accessToken;

  async function generate() {
    if (!token) return setError('Please login on /login first');
    if (conflicts.length > 0) return setError(conflicts.join(', '));
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/itineraries/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ start, date, time, includeSlots, avoidSlots }),
    });
    if (!response.ok) return setError('Generation failed');
    setResult((await response.json()) as PlanSlot[]);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Plan a date itinerary</h1>
      <input value={start.label} onChange={(event) => setStart((prev) => ({ ...prev, label: event.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </div>
      {includeSlots.map((slot, index) => (
        <div className="flex gap-2" key={`${slot}-${index}`}>
          <select value={slot} onChange={(event) => setIncludeSlots((prev) => prev.map((entry, idx) => (idx === index ? (event.target.value as SlotSelection) : entry)))}>
            {allSelections.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <button onClick={() => index > 0 && setIncludeSlots((prev) => {
            const next = [...prev];
            [next[index], next[index - 1]] = [next[index - 1], next[index]];
            return next;
          })}>↑</button>
          <button onClick={() => index < includeSlots.length - 1 && setIncludeSlots((prev) => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
          })}>↓</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => includeSlots.length < 4 && setIncludeSlots((prev) => [...prev, 'DO'])}>Add slot</button>
        <button onClick={() => includeSlots.length > 2 && setIncludeSlots((prev) => prev.slice(0, -1))}>Remove slot</button>
      </div>
      <select onChange={(event) => setAvoidSlots((prev) => [...prev, event.target.value as SlotSelection])} defaultValue="">
        <option value="" disabled>Add avoid slot</option>
        {allSelections.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <div className="flex gap-2 flex-wrap">{avoidSlots.map((slot, idx) => <button key={`${slot}-${idx}`} onClick={() => setAvoidSlots((prev) => prev.filter((_, i) => i !== idx))}>{slot} ×</button>)}</div>
      <button onClick={generate}>Generate</button>
      {error && <p className="text-rose-300">{error}</p>}
      {result.map((slot, index) => <article key={`${slot.placeName}-${index}`} className="border border-slate-700 p-3 rounded"><p>{index + 1}. {slot.placeName}</p><p>{slot.subgroup} · travel {slot.travelMinutes} mins</p></article>)}
    </main>
  );
}
