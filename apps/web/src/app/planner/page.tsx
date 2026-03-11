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

type StartOption = { label: string; lat: number; lng: number; placeId?: string };
type GooglePrediction = { description: string; place_id: string };

const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotSelection[];
const defaultStart: StartOption = { label: 'Marina Bay Sands', lat: 1.2834, lng: 103.8607 };

export default function PlannerPage() {
  const [start, setStart] = useState<StartOption>(defaultStart);
  const [startQuery, setStartQuery] = useState(defaultStart.label);
  const [suggestions, setSuggestions] = useState<GooglePrediction[]>([]);
  const [searchingStart, setSearchingStart] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [includeSlots, setIncludeSlots] = useState<SlotSelection[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotSelection[]>([]);
  const [result, setResult] = useState<PlanSlot[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const conflicts = useMemo(() => detectConflict(includeSlots, avoidSlots), [includeSlots, avoidSlots]);
  const token = readSession()?.accessToken;
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  async function searchStartLocations(query: string) {
    setStartQuery(query);
    setError('');
    if (!googleMapsKey || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setSearchingStart(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:sg&types=establishment|geocode&key=${googleMapsKey}`;
      const response = await fetch(url);
      const data = (await response.json()) as { status: string; predictions?: GooglePrediction[]; error_message?: string };
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        setError(`Location search failed: ${data.error_message ?? data.status}`);
        setSuggestions([]);
        return;
      }
      setSuggestions(data.predictions ?? []);
    } catch (searchError) {
      setSuggestions([]);
      setError(`Location search failed: ${searchError instanceof Error ? searchError.message : 'unknown error'}`);
    } finally {
      setSearchingStart(false);
    }
  }

  async function chooseSuggestion(prediction: GooglePrediction) {
    if (!googleMapsKey) return;
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(prediction.place_id)}&fields=name,geometry,place_id&key=${googleMapsKey}`;
      const response = await fetch(detailsUrl);
      const data = (await response.json()) as {
        status: string;
        result?: { name: string; place_id: string; geometry: { location: { lat: number; lng: number } } };
        error_message?: string;
      };
      if (data.status !== 'OK' || !data.result) {
        return setError(`Location details failed: ${data.error_message ?? data.status}`);
      }
      const next = {
        label: data.result.name,
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng,
        placeId: data.result.place_id,
      };
      setStart(next);
      setStartQuery(next.label);
      setSuggestions([]);
      setInfo(`Start location set to ${next.label}.`);
      setError('');
    } catch (detailsError) {
      setError(`Location details failed: ${detailsError instanceof Error ? detailsError.message : 'unknown error'}`);
    }
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
        <input value={startQuery} onChange={(event) => void searchStartLocations(event.target.value)} placeholder="Search Singapore location" />
        {!googleMapsKey && <p className="text-amber-300 text-sm">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google autocomplete.</p>}
        {searchingStart && <p className="text-slate-400 text-sm">Searching locations...</p>}
        {suggestions.length > 0 && (
          <div className="grid gap-2">
            {suggestions.map((option) => (
              <button key={option.place_id} onClick={() => void chooseSuggestion(option)} className="text-left">
                {option.description}
              </button>
            ))}
          </div>
        )}
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
