'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PlaceDetailsResponse,
  PlaceDetailsResponseSchema,
  PlacesAutocompleteResponse,
  PlacesAutocompleteResponseSchema,
} from '@datewise/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlacesAutocompleteResponse['suggestions']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<PlaceDetailsResponse | null>(null);

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
        const response = await fetch(
          `${API_BASE_URL}/v1/places/autocomplete?q=${encodeURIComponent(debouncedQuery)}`,
        );

        if (!response.ok) {
          throw new Error('Unable to load suggestions.');
        }

        const body = (await response.json()) as unknown;
        const parsed = PlacesAutocompleteResponseSchema.parse(body);
        if (!cancelled) {
          setSuggestions(parsed.suggestions);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setError('Failed to load place suggestions. Please try again.');
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

      const response = await fetch(
        `${API_BASE_URL}/v1/places/details?placeId=${encodeURIComponent(placeId)}`,
      );

      if (!response.ok) {
        throw new Error('Unable to fetch place details.');
      }

      const body = (await response.json()) as unknown;
      const details = PlaceDetailsResponseSchema.parse(body);
      setSelectedOrigin(details);
      setQuery(details.name);
      setSuggestions([]);
    } catch {
      setError('Failed to fetch selected place details.');
    } finally {
      setLoading(false);
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
    </main>
  );
}
