'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CORE_GROUPS, SUBGROUPS, detectConflict, type ItinerarySlot, type SlotType } from '@datewise/shared';
import { apiBaseUrl, readSession } from '../../lib/auth';
import { writeLatestResult } from '../../lib/latest-result';

declare global {
  interface Window {
    google?: any;
  }
}

type StartPoint = { name: string; latitude: number; longitude: number; placeId: string };
type Prediction = { description: string; placePrediction: any };

const allSelections = [...CORE_GROUPS, ...Object.values(SUBGROUPS).flat()] as SlotType[];
const defaultStart: StartPoint = {
  name: 'Marina Bay Sands',
  latitude: 1.2834,
  longitude: 103.8607,
  placeId: 'default-marina-bay-sands',
};
const googleMapsScriptId = 'datewise-google-maps-sdk';

let googleMapsLoadPromise: Promise<void> | null = null;

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function subgroupSummary(slotType: SlotType) {
  if (CORE_GROUPS.includes(slotType as (typeof CORE_GROUPS)[number])) {
    return `${slotType} group`;
  }

  return slotType.replaceAll('_', ' ');
}

export default function PlannerClient({ googleMapsKey }: { googleMapsKey: string }) {
  const [startPoint, setStartPoint] = useState<StartPoint>(defaultStart);
  const [startQuery, setStartQuery] = useState(defaultStart.name);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [googleReady, setGoogleReady] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [slots, setSlots] = useState<SlotType[]>(['EAT', 'DO', 'SIP']);
  const [avoidSlots, setAvoidSlots] = useState<SlotType[]>([]);
  const [result, setResult] = useState<ItinerarySlot[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const autocompleteSuggestionRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const placesDivRef = useRef<HTMLDivElement | null>(null);

  const conflicts = useMemo(() => detectConflict(slots, avoidSlots), [slots, avoidSlots]);
  const token = readSession()?.accessToken;

  useEffect(() => {
    if (!googleMapsKey) return;

    async function initServices() {
      if (!window.google?.maps) return;

      try {
        const placesLibrary = await window.google.maps.importLibrary('places');
        autocompleteSuggestionRef.current = placesLibrary.AutocompleteSuggestion;
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        setGoogleReady(true);
      } catch {
        setError('Google Places library failed to initialize.');
      }
    }

    function ensureGoogleMapsScript() {
      if (window.google?.maps) {
        return Promise.resolve();
      }

      if (googleMapsLoadPromise) {
        return googleMapsLoadPromise;
      }

      googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.getElementById(googleMapsScriptId) as HTMLScriptElement | null;
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(), { once: true });
          existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load.')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.id = googleMapsScriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Maps script failed to load.'));
        document.body.appendChild(script);
      });

      return googleMapsLoadPromise;
    }

    if (window.google?.maps) {
      void initServices();
      return;
    }

    void ensureGoogleMapsScript()
      .then(() => initServices())
      .catch(() => {
        setError('Google Maps script failed to load. Check API enablement and localhost referrer restrictions.');
      });
  }, [googleMapsKey]);

  function clearStatus() {
    setError('');
    setInfo('');
  }

  function searchLocations(query: string) {
    setStartQuery(query);
    clearStatus();

    if (!googleReady || !autocompleteSuggestionRef.current || query.trim().length < 2) {
      setPredictions([]);
      return;
    }

    void (async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        }

        const { suggestions } = await autocompleteSuggestionRef.current.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['sg'],
          sessionToken: sessionTokenRef.current,
        });

        setPredictions(
          (suggestions ?? []).slice(0, 6).map((item: any) => ({
            description: item.placePrediction?.text?.text ?? 'Unnamed place',
            placePrediction: item.placePrediction,
          })),
        );
      } catch (nextError) {
        setPredictions([]);
        setError(nextError instanceof Error ? nextError.message : 'Autocomplete request failed.');
      }
    })();
  }

  function choosePrediction(prediction: Prediction) {
    void (async () => {
      try {
        const place = prediction.placePrediction?.toPlace();
        if (!place) {
          setError('Could not load place details.');
          return;
        }

        await place.fetchFields({
          fields: ['displayName', 'location', 'formattedAddress', 'id'],
        });

        const latitude = typeof place.location?.lat === 'function' ? place.location.lat() : place.location?.lat;
        const longitude = typeof place.location?.lng === 'function' ? place.location.lng() : place.location?.lng;

        if (latitude === undefined || longitude === undefined) {
          setError('Place details did not include coordinates.');
          return;
        }

        const next = {
          name: place.displayName ?? prediction.description,
          latitude,
          longitude,
          placeId: place.id ?? prediction.description,
        };

        setStartPoint(next);
        setStartQuery(next.name);
        setPredictions([]);
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        setInfo(`Start location set to ${next.name}.`);
        setError('');
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Location details failed.');
      }
    })();
  }

  function useCurrentLocation() {
    clearStatus();
    if (!navigator.geolocation) {
      setError('Browser geolocation is not available here.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          name: 'Current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          placeId: 'browser-current-location',
        };
        setStartPoint(next);
        setStartQuery(next.name);
        setPredictions([]);
        setInfo('Using your current location as the start point.');
      },
      () => {
        setError('Could not access your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function replaceSlot(index: number, value: SlotType) {
    setSlots((prev) => prev.map((entry, idx) => (idx === index ? value : entry)));
  }

  function reorderSlots(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= slots.length) return;
    setSlots((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function removeAvoid(value: SlotType) {
    setAvoidSlots((prev) => prev.filter((entry) => entry !== value));
  }

  const payload = { startPoint, date, time, slots, avoidSlots };

  async function generate() {
    if (conflicts.length > 0) {
      setError(conflicts.join(', '));
      return;
    }

    setIsLoading(true);
    clearStatus();

    try {
      const response = await fetch(`${apiBaseUrl()}/itineraries/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Generation failed');
      }

      const generated = (await response.json()) as ItinerarySlot[];
      setResult(generated);
      writeLatestResult({ input: payload, result: generated, savedAt: new Date().toISOString() });
      setInfo('Generated a fresh itinerary.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Generation failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function regenerateAll() {
    await generate();
  }

  async function regenerateSlot(slotIndex: number) {
    setIsLoading(true);
    clearStatus();

    try {
      const response = await fetch(`${apiBaseUrl()}/itineraries/regenerate-slot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...payload, slotIndex, existingPlaceIds: result.map((slot) => slot.place.placeId) }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Regenerate slot failed');
      }

      const updated = (await response.json()) as ItinerarySlot;
      setResult((prev) => {
        const next = prev.map((slot, idx) => (idx === slotIndex ? updated : slot));
        writeLatestResult({ input: payload, result: next, savedAt: new Date().toISOString() });
        return next;
      });
      setInfo(`Replaced stop ${slotIndex + 1}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Regenerate slot failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function save(isPublic: boolean) {
    if (!token) {
      setError('Login required to save itineraries.');
      return;
    }

    setIsLoading(true);
    clearStatus();

    try {
      const response = await fetch(`${apiBaseUrl()}/itineraries/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: payload, result, isPublic }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Save failed');
      }

      setInfo(isPublic ? 'Saved to public itineraries.' : 'Saved to your private itineraries.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Save failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-stack">
      <div ref={placesDivRef} hidden />

      <section className="planner-shell">
        <article className="hero hero-compact">
          <p className="eyebrow">Generate itinerary</p>
          <h1 className="page-title">Build the route.</h1>
          <p className="lede">Set a start point, choose the flow, and generate a date plan.</p>
          <div className="metrics-row">
            <div className="metric">
              <strong>{slots.length}</strong>
              <span>stops</span>
            </div>
            <div className="metric">
              <strong>{avoidSlots.length}</strong>
              <span>blocked</span>
            </div>
            <div className="metric">
              <strong>{result.length || '-'}</strong>
              <span>generated</span>
            </div>
          </div>
          <div className="actions">
            <button className="button-primary" onClick={generate} disabled={isLoading}>
              {isLoading ? 'Working...' : 'Generate itinerary'}
            </button>
            <button className="button-secondary" onClick={regenerateAll} disabled={isLoading || result.length === 0}>
              Regenerate all
            </button>
            <Link className="button-ghost" href="/public">Browse public inspiration</Link>
          </div>
          {!googleMapsKey && <p className="status-message error">Google Maps key was not passed to the planner page.</p>}
        </article>

        <div className="planner-main">
          <section className="hero-grid">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Inputs</p>
                  <h2 className="section-title">Start point and schedule</h2>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="start-location">Start location</label>
                  <input
                    id="start-location"
                    value={startQuery}
                    onChange={(event) => searchLocations(event.target.value)}
                    placeholder="Search for a Singapore location"
                  />
                  {!googleMapsKey && <p className="helper">Add a Google Maps key to enable autocomplete.</p>}
                </div>

                <div className="inline-actions">
                  <button className="button-secondary" onClick={useCurrentLocation} type="button">Use current location</button>
                </div>

                {predictions.length > 0 && (
                  <div className="prediction-list">
                    {predictions.map((option, index) => (
                      <button key={`${option.description}-${index}`} className="prediction-button" onClick={() => choosePrediction(option)} type="button">
                        {option.description}
                      </button>
                    ))}
                  </div>
                )}

                <p className="helper">Selected: {startPoint.name}</p>

                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="date">Date</label>
                    <input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="time">Time</label>
                    <input id="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                  </div>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Rules</p>
                  <h2 className="section-title">Generation summary</h2>
                </div>
              </div>

              <div className="plain-list">
                <div className="simple-row">
                  <strong>{slots.length} slots</strong>
                  <p className="helper">Choose between 2 and 4 stops.</p>
                </div>
                <div className="simple-row">
                  <strong>{avoidSlots.length} blocked</strong>
                  <p className="helper">Conflicting rules stop generation.</p>
                </div>
                <div className="simple-row">
                  <strong>Travel-aware</strong>
                  <p className="helper">Closer and open places are preferred.</p>
                </div>
              </div>
            </article>
          </section>

          <section className="hero-grid">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Slots</p>
                  <h2 className="section-title">Ordered date stops</h2>
                </div>
                <button className="button-secondary" onClick={() => slots.length < 4 && setSlots((prev) => [...prev, 'DO'])} disabled={slots.length >= 4}>
                  Add slot
                </button>
              </div>

              <div className="slot-list">
                {slots.map((slot, index) => (
                  <article
                    key={`${slot}-${index}`}
                    className={`slot-card${draggingIndex === index ? ' dragging' : ''}`}
                    draggable
                    onDragStart={() => setDraggingIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingIndex !== null) reorderSlots(draggingIndex, index);
                      setDraggingIndex(null);
                    }}
                    onDragEnd={() => setDraggingIndex(null)}
                  >
                    <div className="slot-top">
                      <div className="field-stack">
                        <span className="slot-handle">Drag to reorder</span>
                        <strong>Stop {index + 1}</strong>
                        <p className="helper">{subgroupSummary(slot)}</p>
                      </div>
                      <div className="inline-actions">
                        <button className="mini-button" onClick={() => reorderSlots(index, index - 1)} disabled={index === 0} type="button">Up</button>
                        <button className="mini-button" onClick={() => reorderSlots(index, index + 1)} disabled={index === slots.length - 1} type="button">Down</button>
                        <button className="mini-button" onClick={() => slots.length > 2 && setSlots((prev) => prev.filter((_, idx) => idx !== index))} disabled={slots.length <= 2} type="button">
                          Remove
                        </button>
                      </div>
                    </div>

                    <select value={slot} onChange={(event) => replaceSlot(index, event.target.value as SlotType)}>
                      {allSelections.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Avoid</p>
                  <h2 className="section-title">Blocked categories</h2>
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="avoid-select">Add a category to avoid</label>
                  <select
                    id="avoid-select"
                    onChange={(event) => {
                      const next = event.target.value as SlotType;
                      if (!next || avoidSlots.includes(next)) return;
                      setAvoidSlots((prev) => [...prev, next]);
                      event.target.value = '';
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select a core group or subgroup</option>
                    {allSelections.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {avoidSlots.length === 0 ? (
                  <div className="empty-state">No blocked categories.</div>
                ) : (
                  <div className="tag-row">
                    {avoidSlots.map((value) => (
                      <button key={value} className="tag" onClick={() => removeAvoid(value)} type="button">
                        Remove {value}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Status</p>
                <h2 className="section-title">Validation and actions</h2>
              </div>
              <div className="actions">
                <button className="button-secondary" onClick={() => save(false)} disabled={!token || result.length === 0 || isLoading}>
                  Save private
                </button>
                <button className="button-secondary" onClick={() => save(true)} disabled={!token || result.length === 0 || isLoading}>
                  Publish itinerary
                </button>
              </div>
            </div>

            {conflicts.length > 0 && <p className="status-message error">Conflicts: {conflicts.join(', ')}</p>}
            {error && <p className="status-message error">{error}</p>}
            {info && <p className="status-message success">{info}</p>}
            {!token && <p className="helper">Login only matters for saving.</p>}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Results</p>
                <h2 className="section-title">Generated itinerary</h2>
              </div>
            </div>

            {result.length === 0 ? (
              <div className="empty-state">Generate to see your route.</div>
            ) : (
              <div className="timeline">
                {result.map((slot, index) => (
                  <article key={`${slot.place.placeId}-${index}`} className="timeline-card">
                    <div className="timeline-top">
                      <div className="field-stack">
                        <span className="timeline-index">{index + 1}</span>
                        <h3 className="card-title">{slot.place.name}</h3>
                        <p className="helper">{slot.place.address}</p>
                      </div>

                      <div className="actions">
                        <button className="mini-button" onClick={() => regenerateSlot(index)} disabled={isLoading} type="button">
                          Regenerate stop
                        </button>
                      </div>
                    </div>

                    <div className="pill-row">
                      <span className="status-pill">{slot.subgroup}</span>
                      <span className="status-pill">{slot.travelMinutes} min travel</span>
                      <span className="status-pill">{formatClock(slot.arrivalTime)} - {formatClock(slot.departureTime)}</span>
                    </div>
                    <p className="meta">Rating {slot.place.rating?.toFixed(1) ?? 'N/A'}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
