'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AvoidItem,
  CoreGroup,
  GenerateItineraryRequest,
  GenerateItineraryResult,
  GenerateItineraryResultSchema,
  PlaceDetailsResponse,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteResponse,
  PlacesAutocompleteResponseSchema,
  RadiusMode,
  SequenceSlot,
  Subgroup,
} from '@datewise/shared';

const radiusModes: RadiusMode[] = ['WALKABLE', 'SHORT_TRANSIT', 'CAR_GRAB'];
const coreGroups: CoreGroup[] = ['EAT', 'DO', 'SIP'];
const subgroups: Subgroup[] = [
  'JAPANESE', 'KOREAN', 'CHINESE', 'THAI', 'WESTERN', 'ITALIAN', 'INDIAN', 'MALAY', 'INDONESIAN', 'VIETNAMESE', 'MIDDLE_EASTERN', 'SEAFOOD', 'LOCAL', 'HAWKER',
  'MUSEUM', 'GALLERY', 'EXHIBITION', 'SHOPPING', 'WELLNESS', 'CINEMA', 'CLASSES', 'WALK_IN_PARK', 'SCENIC_WALK', 'ARCADE', 'BOWLING', 'KARAOKE', 'ESCAPE_ROOM', 'INDOOR_SPORTS', 'OUTDOOR_ACTIVITY', 'ATTRACTION',
  'COFFEE', 'DESSERT', 'BUBBLE_TEA', 'TEA_HOUSE', 'COCKTAIL', 'WINE', 'BEER', 'SPIRIT',
];

function toFriendlyErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) return `${prefix} (${error.message})`;
  return prefix;
}

type ValidationErrorResponse = {
  message?: string;
  errors?: Array<{ path: string; message: string }>;
};

async function fetchFromWebApi(path: string): Promise<unknown> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as unknown;
}

async function postToWebApi(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const parsedBody = (await response.json()) as { message?: unknown; details?: unknown; errors?: unknown };
  if (!response.ok) {
    const validation = parsedBody as ValidationErrorResponse;
    if (response.status === 400 && validation.message === 'Validation failed' && Array.isArray(validation.errors)) {
      const details = validation.errors.map((error) => `${error.path}: ${error.message}`).join(', ');
      throw new Error(`Validation failed: ${details}`);
    }

    let details = `Request failed with status ${response.status}`;
    if (typeof parsedBody.message === 'string') details = parsedBody.message;
    if (typeof parsedBody.details === 'string') details = `${details} (${parsedBody.details})`;
    throw new Error(details);
  }

  return parsedBody;
}

function formatTravelRatio(ratio: number | undefined): string {
  if (typeof ratio !== 'number') return 'n/a';
  return `${Math.round(ratio * 100)}%`;
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlacesAutocompleteResponse['suggestions']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<PlaceDetailsResponse | null>(null);

  const [date, setDate] = useState('2026-01-10');
  const [startTime, setStartTime] = useState('18:00');
  const [budgetLevel, setBudgetLevel] = useState<1 | 2 | 3>(2);
  const [radiusMode, setRadiusMode] = useState<RadiusMode>('SHORT_TRANSIT');
  const [sequence, setSequence] = useState<SequenceSlot[]>([
    { type: 'CORE', core: 'DO' },
    { type: 'CORE', core: 'EAT' },
    { type: 'CORE', core: 'SIP' },
  ]);
  const [avoidItems, setAvoidItems] = useState<AvoidItem[]>([]);

  const [result, setResult] = useState<GenerateItineraryResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      setError(null);
      return;
    }

    let cancelled = false;
    async function loadSuggestions() {
      try {
        setLoading(true);
        const body = await fetchFromWebApi(`/api/places/autocomplete?q=${encodeURIComponent(debouncedQuery)}`);
        const parsed = PlacesAutocompleteResponseSchema.parse(body);
        if (!cancelled) setSuggestions(parsed.suggestions);
      } catch (caughtError) {
        if (!cancelled) setError(toFriendlyErrorMessage('Failed to load place suggestions.', caughtError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasSuggestions = useMemo(() => suggestions.length > 0, [suggestions]);

  async function onSelectSuggestion(placeId: string) {
    try {
      setLoading(true);
      const body = await fetchFromWebApi(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);
      const details = PlaceDetailsResponseSchema.parse(body);
      setSelectedOrigin(details);
      setQuery(details.name);
      setSuggestions([]);
      setError(null);
    } catch (caughtError) {
      setError(toFriendlyErrorMessage('Failed to fetch selected place details.', caughtError));
    } finally {
      setLoading(false);
    }
  }

  function updateSlot(index: number, value: string) {
    const updated = [...sequence];
    if (value.startsWith('CORE:')) {
      updated[index] = { type: 'CORE', core: value.replace('CORE:', '') as CoreGroup };
    } else {
      updated[index] = { type: 'SUBGROUP', subgroup: value.replace('SUBGROUP:', '') as Subgroup };
    }
    setSequence(updated);
  }

  function addSlot() {
    if (sequence.length >= 5) return;
    setSequence((current) => [...current, { type: 'CORE', core: 'EAT' }]);
  }

  function removeSlot(index: number) {
    if (sequence.length <= 2) return;
    setSequence((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function isAvoided(item: AvoidItem): boolean {
    return avoidItems.some((entry) => (item.type === 'CORE' && entry.type === 'CORE' && entry.core === item.core)
      || (item.type === 'SUBGROUP' && entry.type === 'SUBGROUP' && entry.subgroup === item.subgroup));
  }

  function toggleAvoidItem(item: AvoidItem) {
    setAvoidItems((current) => (isAvoided(item)
      ? current.filter((entry) => !((item.type === 'CORE' && entry.type === 'CORE' && entry.core === item.core)
        || (item.type === 'SUBGROUP' && entry.type === 'SUBGROUP' && entry.subgroup === item.subgroup)))
      : [...current, item]));
  }

  async function onGenerateItinerary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrigin) {
      setGenerateError('Please select an origin first.');
      return;
    }

    const request: GenerateItineraryRequest = {
      origin: selectedOrigin,
      date,
      startTime,
      budgetLevel,
      radiusMode,
      sequence,
      avoid: avoidItems,
    };

    try {
      const responseBody = await postToWebApi('/api/itineraries/generate', request);
      const parsed = GenerateItineraryResultSchema.parse(responseBody);
      setResult(parsed);
      setGenerateError(null);
    } catch (caughtError) {
      setResult(null);
      setGenerateError(toFriendlyErrorMessage('Failed to generate itinerary.', caughtError));
    }
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '60rem' }}>
      <h1>Datewise Web</h1>
      <p>Build a sequence-based Singapore date itinerary with travel-aware scheduling.</p>

      <label htmlFor="origin-search">Origin search</label>
      <input id="origin-search" type="text" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: '100%', padding: '0.5rem' }} />

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      {hasSuggestions ? (
        <ul style={{ border: '1px solid #ddd', borderRadius: '0.25rem', padding: '0.5rem' }}>
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId} style={{ listStyle: 'none', marginBottom: '0.5rem' }}>
              <button type="button" style={{ width: '100%', textAlign: 'left' }} onClick={() => void onSelectSuggestion(suggestion.placeId)}>
                <strong>{suggestion.primaryText}</strong>
                <br />
                <span>{suggestion.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onGenerateItinerary} style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
        <label>Date</label>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <label>Start time</label>
        <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />

        <label>Budget level</label>
        <select value={String(budgetLevel)} onChange={(event) => setBudgetLevel(Number(event.target.value) as 1 | 2 | 3)}>
          <option value="1">1</option><option value="2">2</option><option value="3">3</option>
        </select>

        <label>Radius mode</label>
        <select value={radiusMode} onChange={(event) => setRadiusMode(event.target.value as RadiusMode)}>
          {radiusModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </select>

        <fieldset>
          <legend>Sequence slots (2-5)</legend>
          {sequence.map((slot, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <select
                style={{ flex: 1 }}
                value={slot.type === 'CORE' ? `CORE:${slot.core}` : `SUBGROUP:${slot.subgroup}`}
                onChange={(event) => updateSlot(index, event.target.value)}
              >
                {coreGroups.map((core) => <option key={`core-${core}`} value={`CORE:${core}`}>{`CORE: ${core}`}</option>)}
                {subgroups.map((subgroup) => <option key={`sub-${subgroup}`} value={`SUBGROUP:${subgroup}`}>{`SUBGROUP: ${subgroup}`}</option>)}
              </select>
              <button type="button" onClick={() => removeSlot(index)} disabled={sequence.length <= 2}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addSlot} disabled={sequence.length >= 5}>Add slot</button>
        </fieldset>

        <fieldset>
          <legend>Avoid panel (core + subgroup)</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <h4>Core</h4>
              {coreGroups.map((core) => (
                <label key={core} style={{ display: 'block' }}>
                  <input type="checkbox" checked={isAvoided({ type: 'CORE', core })} onChange={() => toggleAvoidItem({ type: 'CORE', core })} />
                  {core}
                </label>
              ))}
            </div>
            <div>
              <h4>Subgroup</h4>
              <div style={{ maxHeight: '180px', overflow: 'auto', border: '1px solid #ddd', padding: '0.25rem' }}>
                {subgroups.map((subgroup) => (
                  <label key={subgroup} style={{ display: 'block' }}>
                    <input type="checkbox" checked={isAvoided({ type: 'SUBGROUP', subgroup })} onChange={() => toggleAvoidItem({ type: 'SUBGROUP', subgroup })} />
                    {subgroup}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <button type="submit">Generate</button>
      </form>

      {generateError ? <p style={{ color: 'crimson' }}>{generateError}</p> : null}
      {result?.status === 'OK' ? (
        <section>
          <h2>Itinerary</h2>
          <p><strong>ID:</strong> {result.itineraryId}</p>
          <p><strong>Estimated duration:</strong> {result.totals.durationLabel}</p>
          <p><strong>Travel share:</strong> {formatTravelRatio(result.meta.travelTimeRatio)}</p>

          <h3>Stops</h3>
          <ul>
            {result.stops.map((stop, index) => (
              <li key={`${stop.name}-${index}`}>
                {index + 1}. {stop.name} ({stop.subgroup ?? stop.core ?? 'n/a'})
                {' '}— {stop.arrivalTime ?? 'n/a'} to {stop.departTime ?? 'n/a'}
              </li>
            ))}
          </ul>

          <h3>Legs</h3>
          <ul>
            {result.legs.map((leg) => (
              <li key={`${leg.from}-${leg.to}`}>#{leg.from + 1} → #{leg.to + 1}: {leg.mode} {leg.distanceM}m / {leg.durationMin} min</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result?.status === 'CONFLICT' ? (
        <section>
          <h2>Conflict</h2>
          <p>{result.reason}: {result.message}</p>
          <ul>
            {result.suggestions.map((suggestion, index) => <li key={index}>{suggestion.message}</li>)}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
