'use client';

import { useMemo, useState } from 'react';
import { detectConflict, CORE_GROUPS, SUBGROUPS, type SlotSelection } from '../../../../../packages/shared/src/index';
import { apiBaseUrl, readSession } from '../../lib/auth';

type PlanSlot = {
  slotIndex: number;
  selection: SlotSelection;
  placeName: string;
  travelMinutes: number;
  startOffsetMin: number;
  durationMin: number;
  subgroup: string;
};

type StartOption = { label: string; lat: number; lng: number };

const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotSelection[];
const startOptions: StartOption[] = [
  { label: 'Marina Bay Sands', lat: 1.2834, lng: 103.8607 },
  { label: 'Orchard Road', lat: 1.3048, lng: 103.8318 },
  { label: 'Gardens by the Bay', lat: 1.2816, lng: 103.8636 },
  { label: 'Clarke Quay', lat: 1.2906, lng: 103.8465 },
  { label: 'Chinatown MRT', lat: 1.284, lng: 103.8439 },
  { label: 'Bugis Junction', lat: 1.299, lng: 103.8553 },
  { label: 'Tiong Bahru', lat: 1.2854, lng: 103.8272 },
  { label: 'Holland Village', lat: 1.3112, lng: 103.7967 },
  { label: 'Sentosa', lat: 1.2494, lng: 103.8303 },
  { label: 'East Coast Park', lat: 1.3039, lng: 103.9122 },
];

export default function PlannerPage() {
  const [start, setStart] = useState<StartOption>(startOptions[0]);
  const [startQuery, setStartQuery] = useState(startOptions[0].label);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [includeSlots, setIncludeSlots] = useState<SlotSelection[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotSelection[]>([]);
  const [result, setResult] = useState<PlanSlot[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const conflicts = useMemo(() => detectConflict(includeSlots, avoidSlots), [includeSlots, avoidSlots]);
  const token = readSession()?.accessToken;
  const filteredStartOptions = useMemo(
    () => startOptions.filter((option) => option.label.toLowerCase().includes(startQuery.toLowerCase())).slice(0, 6),
    [startQuery],
  );

  function applyStart(option: StartOption) {
    setStart(option);
    setStartQuery(option.label);
    setInfo(`Start location set to ${option.label}`);
    setError('');
  }

  async function generate() {
    if (!token) return setError('Please login first');
    if (conflicts.length > 0) return setError(conflicts.join(', '));

    const response = await fetch(`${apiBaseUrl()}/itineraries/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ start, date, time, includeSlots, avoidSlots }),
    });

    if (!response.ok) {
      const text = await response.text();
      return setError(`Generation failed: ${text}`);
    }

    setResult((await response.json()) as PlanSlot[]);
    setError('');
    setInfo('Generated itinerary successfully.');
  }

  async function regenerateSlot(slotIndex: number) {
    if (!token) return setError('Please login first');
    const response = await fetch(`${apiBaseUrl()}/itineraries/regenerate-slot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ start, date, time, includeSlots, avoidSlots, slotIndex, existingPlaceNames: result.map((slot) => slot.placeName) }),
    });
    if (!response.ok) {
      const text = await response.text();
      return setError(`Regenerate slot failed: ${text}`);
    }
    const updated = (await response.json()) as PlanSlot;
    setResult((prev) => prev.map((slot, idx) => (idx === slotIndex ? updated : slot)));
    setError('');
    setInfo(`Regenerated slot ${slotIndex + 1}.`);
  }

  async function save(isPublic: boolean) {
    if (!token) return setError('Please login first');
    const response = await fetch(`${apiBaseUrl()}/itineraries/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ input: { start, date, time, includeSlots, avoidSlots }, isPublic }),
    });

    if (!response.ok) {
      const text = await response.text();
      return setError(`Save failed: ${text}`);
    }
    setError('');
    setInfo(isPublic ? 'Saved to public itineraries.' : 'Saved to your profile itineraries.');
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Plan a date itinerary</h1>
      <p className="text-slate-300">Singapore-only itinerary builder with 2-4 slots.</p>

      <section className="grid gap-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Start point</h2>
        <input value={startQuery} onChange={(event) => setStartQuery(event.target.value)} placeholder="Search start location" />
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredStartOptions.map((option) => (
            <button key={option.label} onClick={() => applyStart(option)} className="text-left">
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-slate-400 text-sm">
          Selected: {start.label} ({start.lat.toFixed(4)}, {start.lng.toFixed(4)})
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
      </section>

      <section className="grid gap-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Slots ({includeSlots.length}/4)</h2>
        {includeSlots.map((slot, index) => (
          <div className="flex gap-2" key={`${slot}-${index}`}>
            <select value={slot} onChange={(event) => setIncludeSlots((prev) => prev.map((entry, idx) => (idx === index ? (event.target.value as SlotSelection) : entry)))}>
              {allSelections.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <button
              onClick={() =>
                index > 0 &&
                setIncludeSlots((prev) => {
                  const next = [...prev];
                  [next[index], next[index - 1]] = [next[index - 1], next[index]];
                  return next;
                })
              }
            >
              ↑
            </button>
            <button
              onClick={() =>
                index < includeSlots.length - 1 &&
                setIncludeSlots((prev) => {
                  const next = [...prev];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  return next;
                })
              }
            >
              ↓
            </button>
            <button onClick={() => includeSlots.length > 2 && setIncludeSlots((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
          </div>
        ))}
        <button onClick={() => includeSlots.length < 4 && setIncludeSlots((prev) => [...prev, 'DO'])}>Add slot</button>
      </section>

      <section className="grid gap-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Avoid categories</h2>
        <select onChange={(event) => event.target.value && setAvoidSlots((prev) => [...prev, event.target.value as SlotSelection])} defaultValue="">
          <option value="" disabled>
            Add avoid slot
          </option>
          {allSelections.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {avoidSlots.map((slot, idx) => (
            <button key={`${slot}-${idx}`} onClick={() => setAvoidSlots((prev) => prev.filter((_, i) => i !== idx))}>
              {slot} ×
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        <button onClick={generate}>Generate</button>
        <button onClick={() => save(false)} disabled={result.length === 0}>
          Save private
        </button>
        <button onClick={() => save(true)} disabled={result.length === 0}>
          Save public
        </button>
      </div>

      {conflicts.length > 0 && <p className="text-amber-300">Conflicts: {conflicts.join(', ')}</p>}
      {error && <p className="text-rose-300">{error}</p>}
      {info && <p className="text-emerald-300">{info}</p>}

      <section className="space-y-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Generated itinerary</h2>
        {result.length === 0 && <p className="text-slate-400">No itinerary generated yet.</p>}
        {result.map((slot, index) => (
          <article key={`${slot.placeName}-${index}`} className="rounded border border-slate-700 p-3">
            <p className="font-semibold">
              {index + 1}. {slot.placeName}
            </p>
            <p>
              {slot.subgroup} · travel {slot.travelMinutes} mins · arrive +{slot.startOffsetMin} mins · stay {slot.durationMin} mins
            </p>
            <button onClick={() => regenerateSlot(index)}>Regenerate this slot</button>
          </article>
        ))}
      </section>
    </main>
  );
}
