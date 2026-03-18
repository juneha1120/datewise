'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { detectConflict, CORE_GROUPS, SUBGROUPS, type SlotType } from '@datewise/shared';
import { apiBaseUrl, readSession } from '../../lib/auth';

declare global {
  interface Window {
    google?: any;
  }
}

type PlanSlot = {
  slotIndex: number;
  slotType: SlotType;
  subgroup: string;
  travelMinutes: number;
  arrivalTime: string;
  departureTime: string;
  place: {
    name: string;
    placeId: string;
    latitude: number;
    longitude: number;
    address: string;
    rating?: number;
  };
};

type StartPoint = { name: string; latitude: number; longitude: number; placeId: string };
type Prediction = { description: string; place_id: string };

const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotType[];
const defaultStart: StartPoint = { name: 'Marina Bay Sands', latitude: 1.2834, longitude: 103.8607, placeId: 'default-marina-bay-sands' };

export default function PlannerPage() {
  const [startPoint, setStartPoint] = useState<StartPoint>(defaultStart);
  const [startQuery, setStartQuery] = useState(defaultStart.name);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [googleReady, setGoogleReady] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [slots, setSlots] = useState<SlotType[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotType[]>([]);
  const [result, setResult] = useState<PlanSlot[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const placesDivRef = useRef<HTMLDivElement | null>(null);

  const conflicts = useMemo(() => detectConflict(slots, avoidSlots), [slots, avoidSlots]);
  const token = readSession()?.accessToken;
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!googleMapsKey) return;

    function initServices() {
      if (!window.google?.maps?.places || !placesDivRef.current) return;
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      placesServiceRef.current = new window.google.maps.places.PlacesService(placesDivRef.current);
      setGoogleReady(true);
    }

    if (window.google?.maps?.places) {
      initServices();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initServices;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [googleMapsKey]);

  function searchLocations(query: string) {
    setStartQuery(query);
    setError('');
    if (!googleReady || !autocompleteServiceRef.current || query.trim().length < 2) {
      setPredictions([]);
      return;
    }

    autocompleteServiceRef.current.getPlacePredictions({ input: query, componentRestrictions: { country: 'sg' } }, (suggestions: Prediction[] | null, status: string) => {
      if (status !== 'OK' || !suggestions) {
        setPredictions([]);
        return;
      }
      setPredictions(suggestions.slice(0, 6));
    });
  }

  function choosePrediction(prediction: Prediction) {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails({ placeId: prediction.place_id, fields: ['name', 'geometry', 'place_id'] }, (place: any, status: string) => {
      if (status !== 'OK' || !place?.geometry?.location) {
        setError(`Location details failed: ${status}`);
        return;
      }

      const next = {
        name: place.name ?? prediction.description,
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
        placeId: place.place_id,
      };

      setStartPoint(next);
      setStartQuery(next.name);
      setPredictions([]);
      setInfo(`Start location set to ${next.name}.`);
      setError('');
    });
  }

  const payload = { startPoint, date, time, slots, avoidSlots };

  async function generate() {
    if (conflicts.length > 0) return setError(conflicts.join(', '));

    const response = await fetch(`${apiBaseUrl()}/itineraries/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
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
    const response = await fetch(`${apiBaseUrl()}/itineraries/regenerate-slot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...payload, slotIndex, existingPlaceIds: result.map((slot) => slot.place.placeId) }),
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
    if (!token) return setError('Login required to save itineraries.');
    const response = await fetch(`${apiBaseUrl()}/itineraries/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ input: payload, result, isPublic }),
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
      <div ref={placesDivRef} className="hidden" />
      <h1 className="text-3xl font-bold">Plan a date itinerary</h1>

      <section className="grid gap-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Start point</h2>
        <input value={startQuery} onChange={(event) => searchLocations(event.target.value)} placeholder="Search Singapore location" />
        {!googleMapsKey && <p className="text-amber-300 text-sm">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google autocomplete.</p>}
        {predictions.length > 0 && (
          <div className="grid gap-2">
            {predictions.map((option) => (
              <button key={option.place_id} onClick={() => choosePrediction(option)} className="text-left">
                {option.description}
              </button>
            ))}
          </div>
        )}
        <p className="text-slate-400 text-sm">
          Selected: {startPoint.name} ({startPoint.latitude.toFixed(4)}, {startPoint.longitude.toFixed(4)})
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
      </section>

      <section className="grid gap-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Slots ({slots.length}/4)</h2>
        {slots.map((slot, index) => (
          <div className="flex gap-2" key={`${slot}-${index}`}>
            <select value={slot} onChange={(event) => setSlots((prev) => prev.map((entry, idx) => (idx === index ? (event.target.value as SlotType) : entry)))}>
              {allSelections.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <button onClick={() => index > 0 && setSlots((prev) => { const next = [...prev]; [next[index], next[index - 1]] = [next[index - 1], next[index]]; return next; })}>↑</button>
            <button onClick={() => index < slots.length - 1 && setSlots((prev) => { const next = [...prev]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>↓</button>
            <button onClick={() => slots.length > 2 && setSlots((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
          </div>
        ))}
        <button onClick={() => slots.length < 4 && setSlots((prev) => [...prev, 'DO'])}>Add slot</button>
      </section>

      <section className="grid gap-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Avoid categories</h2>
        <select onChange={(event) => event.target.value && setAvoidSlots((prev) => [...prev, event.target.value as SlotType])} defaultValue="">
          <option value="" disabled>Add avoid slot</option>
          {allSelections.map((option) => <option key={option}>{option}</option>)}
        </select>
      </section>

      <div className="flex gap-2">
        <button onClick={generate}>Generate</button>
        <button onClick={() => save(false)} disabled={!token || result.length === 0}>Save private</button>
        <button onClick={() => save(true)} disabled={!token || result.length === 0}>Save public</button>
      </div>

      {conflicts.length > 0 && <p className="text-amber-300">Conflicts: {conflicts.join(', ')}</p>}
      {error && <p className="text-rose-300">{error}</p>}
      {info && <p className="text-emerald-300">{info}</p>}

      <section className="space-y-2 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Generated itinerary</h2>
        {result.length === 0 && <p className="text-slate-400">No itinerary generated yet.</p>}
        {result.map((slot, index) => (
          <article key={`${slot.place.placeId}-${index}`} className="rounded border border-slate-700 p-3">
            <p className="font-semibold">{index + 1}. {slot.place.name}</p>
            <p>{slot.subgroup} · travel {slot.travelMinutes} mins</p>
            <p>{new Date(slot.arrivalTime).toLocaleTimeString()} - {new Date(slot.departureTime).toLocaleTimeString()}</p>
            <button onClick={() => regenerateSlot(index)}>Regenerate this slot</button>
          </article>
        ))}
      </section>
    </main>
  );
}
