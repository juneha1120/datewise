'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  GenerateItineraryResponseSchema,
  PlaceDetailsResponse,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteResponse,
  PlacesAutocompleteResponseSchema,
} from '@datewise/shared';

function toFriendlyErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${prefix} (${error.message})`;
  }

  return prefix;
}

type ValidationErrorResponse = {
  message?: string;
  errors?: Array<{ path: string; message: string }>;
};

async function fetchFromWebApi(path: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(path);
  } catch (error) {
    if (path.startsWith('/api/places/')) {
      return fetchFromBrowserApi(path);
    }

    throw error;
  }

  if (!response.ok) {
    let details = `HTTP ${response.status}`;
    let parsedBody:
      | {
          message?: unknown;
          code?: unknown;
          details?: unknown;
          triedBaseUrls?: unknown;
        }
      | null = null;

    try {
      parsedBody = (await response.json()) as {
        message?: unknown;
        code?: unknown;
        details?: unknown;
        triedBaseUrls?: unknown;
      };

      if (typeof parsedBody.code === 'string' && typeof parsedBody.message === 'string') {
        details = `${parsedBody.code}: ${parsedBody.message}`;
      } else if (typeof parsedBody.message === 'string') {
        details = parsedBody.message;
      }

      if (typeof parsedBody.details === 'string') {
        details = `${details} (${parsedBody.details})`;
      }

      if (Array.isArray(parsedBody.triedBaseUrls) && parsedBody.triedBaseUrls.every((item) => typeof item === 'string')) {
        details = `${details} [tried: ${parsedBody.triedBaseUrls.join(', ')}]`;
      }
    } catch {
      // fall back to status code only
    }

    if (
      parsedBody &&
      typeof parsedBody.code === 'string' &&
      parsedBody.code === 'UPSTREAM_UNREACHABLE' &&
      path.startsWith('/api/places/')
    ) {
      return fetchFromBrowserApi(path);
    }

    throw new Error(details);
  }

  return (await response.json()) as unknown;
}

async function postToWebApi(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const parsedBody = (await response.json()) as unknown;

  if (!response.ok) {
    const validation = parsedBody as ValidationErrorResponse;
    if (response.status === 400 && validation.message === 'Validation failed' && Array.isArray(validation.errors)) {
      const details = validation.errors.map((error) => `${error.path}: ${error.message}`).join(', ');
      throw new Error(`Validation failed: ${details}`);
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return parsedBody;
}

function getBrowserApiBaseUrls(): string[] {
  const locationDerivedBaseUrl =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.protocol}//${window.location.hostname}:3001`;

  const browserApiBaseCandidates = [
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim(),
    locationDerivedBaseUrl,
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://[::1]:3001',
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/+$/u, ''));

  return [...new Set(browserApiBaseCandidates)];
}

function toBackendPath(webApiPath: string): string {
  return webApiPath.replace(/^\/api\/places\//u, '/v1/places/');
}

async function fetchFromBrowserApi(path: string): Promise<unknown> {
  const backendPath = toBackendPath(path);
  let lastError: Error | null = null;
  const attempted: string[] = [];

  for (const baseUrl of getBrowserApiBaseUrls()) {
    try {
      const response = await fetch(`${baseUrl}${backendPath}`);
      if (!response.ok) {
        let details = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { message?: unknown; code?: unknown };
          if (typeof body.code === 'string' && typeof body.message === 'string') {
            details = `${body.code}: ${body.message}`;
          } else if (typeof body.message === 'string') {
            details = body.message;
          }
        } catch {
          // fall back to status code
        }

        throw new Error(`${baseUrl} -> ${details}`);
      }

      return (await response.json()) as unknown;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      attempted.push(`${baseUrl} -> ${normalizedError.message}`);
      lastError = normalizedError;
    }
  }

  if (attempted.length > 0) {
    throw new Error(
      `Browser fallback to API failed. Ensure \`npm run dev:api\` is running and reachable on port 3001. Tried: ${attempted.join(' | ')}`,
    );
  }

  throw lastError ?? new Error('Browser fallback to API failed.');
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
  const [durationMin, setDurationMin] = useState('180');
  const [budget, setBudget] = useState('$$');
  const [dateStyle, setDateStyle] = useState('SCENIC');
  const [vibe, setVibe] = useState('ROMANTIC');
  const [food, setFood] = useState('');
  const [avoid, setAvoid] = useState('');
  const [transport, setTransport] = useState('TRANSIT');
  const [itinerary, setItinerary] = useState<GenerateItineraryResponse | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

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
        setError(null);
        const body = await fetchFromWebApi(
          `/api/places/autocomplete?q=${encodeURIComponent(debouncedQuery)}`,
        );

        const parsed = PlacesAutocompleteResponseSchema.parse(body);
        if (!cancelled) {
          setSuggestions(parsed.suggestions);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setSuggestions([]);
          setError(toFriendlyErrorMessage('Failed to load place suggestions. Please try again.', caughtError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
      setError(null);

      const body = await fetchFromWebApi(`/api/places/details?placeId=${encodeURIComponent(placeId)}`);

      const details = PlaceDetailsResponseSchema.parse(body);
      setSelectedOrigin(details);
      setQuery(details.name);
      setSuggestions([]);
    } catch (caughtError) {
      setError(toFriendlyErrorMessage('Failed to fetch selected place details.', caughtError));
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateItinerary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrigin) {
      setGenerateError('Please select an origin first.');
      return;
    }

    setGenerateError(null);

    const request: GenerateItineraryRequest = {
      origin: selectedOrigin,
      date,
      startTime,
      durationMin: Number(durationMin),
      budget,
      dateStyle,
      vibe,
      food: food.trim() ? food.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
      avoid: avoid.trim() ? avoid.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
      transport: transport.trim() || undefined,
    };

    try {
      const responseBody = await postToWebApi('/api/itineraries/generate', request);
      const parsed = GenerateItineraryResponseSchema.parse(responseBody);
      setItinerary(parsed);
    } catch (caughtError) {
      setItinerary(null);
      setGenerateError(toFriendlyErrorMessage('Failed to generate itinerary.', caughtError));
    }
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '42rem' }}>
      <h1>Datewise Web</h1>
      <p>Search for your Singapore origin to begin planning your date itinerary.</p>

      <label htmlFor="origin-search" style={{ display: 'block', marginBottom: '0.5rem' }}>
        Origin search
      </label>
      <input
        id="origin-search"
        type="text"
        placeholder="Search Singapore location..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem' }}
      />

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      {hasSuggestions ? (
        <ul style={{ border: '1px solid #ddd', borderRadius: '0.25rem', padding: '0.5rem' }}>
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId} style={{ listStyle: 'none', marginBottom: '0.5rem' }}>
              <button
                type="button"
                style={{ width: '100%', textAlign: 'left', padding: '0.5rem' }}
                onClick={() => {
                  void onSelectSuggestion(suggestion.placeId);
                }}
              >
                <strong>{suggestion.primaryText}</strong>
                <br />
                <span>{suggestion.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedOrigin ? (
        <section style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #e5e7eb' }}>
          <h2 style={{ marginTop: 0 }}>Selected origin</h2>
          <pre style={{ margin: 0 }}>{JSON.stringify(selectedOrigin, null, 2)}</pre>
        </section>
      ) : null}

      <section style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #e5e7eb' }}>
        <h2 style={{ marginTop: 0 }}>Generate stub itinerary</h2>
        <form onSubmit={onGenerateItinerary}>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <br />
          <label htmlFor="start-time">Start time</label>
          <input id="start-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <br />
          <label htmlFor="duration">Duration (min)</label>
          <input id="duration" type="number" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} />
          <br />
          <label htmlFor="budget">Budget</label>
          <input id="budget" value={budget} onChange={(event) => setBudget(event.target.value)} />
          <br />
          <label htmlFor="date-style">Date style</label>
          <input id="date-style" value={dateStyle} onChange={(event) => setDateStyle(event.target.value)} />
          <br />
          <label htmlFor="vibe">Vibe</label>
          <input id="vibe" value={vibe} onChange={(event) => setVibe(event.target.value)} />
          <br />
          <label htmlFor="food">Food preferences (comma separated)</label>
          <input id="food" value={food} onChange={(event) => setFood(event.target.value)} />
          <br />
          <label htmlFor="avoid">Avoid (comma separated)</label>
          <input id="avoid" value={avoid} onChange={(event) => setAvoid(event.target.value)} />
          <br />
          <label htmlFor="transport">Transport</label>
          <input id="transport" value={transport} onChange={(event) => setTransport(event.target.value)} />
          <br />
          <button type="submit" style={{ marginTop: '0.75rem' }}>Generate</button>
        </form>
        {generateError ? <p style={{ color: 'crimson' }}>{generateError}</p> : null}
        {itinerary ? (
          <div>
            <p>
              <strong>Itinerary ID:</strong> {itinerary.itineraryId}
            </p>
            <ul>
              {itinerary.stops.map((stop, index) => (
                <li key={`${stop.name}-${index}`}>
                  {stop.name} ({stop.kind})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
