'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { apiBaseUrl, readSession } from '../../../lib/auth';

type Slot = {
  place: { name: string; address?: string; rating?: number };
  subgroup: string;
  slotType?: string;
  arrivalTime?: string;
  departureTime?: string;
  travelMinutes?: number;
};

type DetailRecord = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  isPublic?: boolean;
  sourceItineraryId?: string | null;
  input?: {
    startPoint?: { name: string };
    date?: string;
    time?: string;
    slots?: string[];
    avoidSlots?: string[];
  };
  result?: Slot[];
  snapshot?: {
    id: string;
    createdAt?: string;
    input?: DetailRecord['input'];
    result?: Slot[];
  };
};

function formatClock(value?: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Unknown';
}

export default function ItineraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [error, setError] = useState('');
  const itineraryId = use(params).id;

  useEffect(() => {
    async function load() {
      const token = readSession()?.accessToken;
      const authHeaders = token ? { authorization: `Bearer ${token}` } : undefined;

      const publicResponse = await fetch(`${apiBaseUrl()}/itineraries/public`);
      if (publicResponse.ok) {
        const publicItems = (await publicResponse.json()) as DetailRecord[];
        const match = publicItems.find((item) => item.id === itineraryId);
        if (match) {
          setRecord(match);
          return;
        }
      }

      if (authHeaders) {
        const [mineResponse, savedResponse] = await Promise.all([
          fetch(`${apiBaseUrl()}/itineraries/mine`, { headers: authHeaders }),
          fetch(`${apiBaseUrl()}/itineraries/saved/mine`, { headers: authHeaders }),
        ]);

        if (mineResponse.ok) {
          const mineItems = (await mineResponse.json()) as DetailRecord[];
          const mineMatch = mineItems.find((item) => item.id === itineraryId);
          if (mineMatch) {
            setRecord(mineMatch);
            return;
          }
        }

        if (savedResponse.ok) {
          const savedItems = (await savedResponse.json()) as DetailRecord[];
          const savedMatch = savedItems.find((item) => item.id === itineraryId);
          if (savedMatch) {
            setRecord(savedMatch);
            return;
          }
        }
      }

      setError('Could not find that itinerary in the public, private, or saved collections available to this browser session.');
    }

    void load();
  }, [itineraryId]);

  const source = record?.snapshot ?? record;
  const slots = source?.result ?? [];

  return (
    <main className="cards-grid">
      <section className="hero">
        <p className="eyebrow">Itinerary detail</p>
        <h1 className="page-title">{source?.input?.startPoint?.name ?? 'Datewise itinerary'}</h1>
        <p className="lede">
          Inspect the stored input and generated output for a single itinerary. Saved public copies show their immutable snapshot details here.
        </p>
        <div className="actions">
          <Link href="/planner" className="button-primary">Back to planner</Link>
          <Link href="/profile" className="button-secondary">Profile</Link>
        </div>
        {error && <p className="status-message error">{error}</p>}
      </section>

      {record && (
        <section className="grid-2">
          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Stored input</p>
                <h2 className="section-title">What the user asked for</h2>
              </div>
            </div>

            <div className="plain-list">
              <div className="simple-row">
                <strong>Start</strong>
                <p className="helper">{source?.input?.startPoint?.name ?? 'Unknown start point'}</p>
              </div>
              <div className="simple-row">
                <strong>Date and time</strong>
                <p className="helper">{source?.input?.date ?? 'Unknown date'} at {source?.input?.time ?? 'Unknown time'}</p>
              </div>
              <div className="simple-row">
                <strong>Requested slots</strong>
                <p className="helper">{source?.input?.slots?.join(', ') ?? 'Unknown'}</p>
              </div>
              <div className="simple-row">
                <strong>Avoided categories</strong>
                <p className="helper">{source?.input?.avoidSlots?.join(', ') || 'None'}</p>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Metadata</p>
                <h2 className="section-title">How it was stored</h2>
              </div>
            </div>

            <div className="plain-list">
              <div className="simple-row">
                <strong>Record id</strong>
                <p className="helper">{record.id}</p>
              </div>
              {record.snapshot && (
                <div className="simple-row">
                  <strong>Snapshot source</strong>
                  <p className="helper">{record.sourceItineraryId ?? 'Saved copy'}</p>
                </div>
              )}
              {record.createdAt && (
                <div className="simple-row">
                  <strong>Created</strong>
                  <p className="helper">{new Date(record.createdAt).toLocaleString()}</p>
                </div>
              )}
              {'isPublic' in record && (
                <div className="simple-row">
                  <strong>Visibility</strong>
                  <p className="helper">{record.isPublic ? 'Public' : 'Private'}</p>
                </div>
              )}
            </div>
          </article>
        </section>
      )}

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Generated output</p>
            <h2 className="section-title">Planned stops</h2>
          </div>
        </div>

        {slots.length === 0 ? (
          <div className="empty-state">No slot details available for this itinerary.</div>
        ) : (
          <div className="timeline">
            {slots.map((slot, index) => (
              <article key={`${slot.place.name}-${index}`} className="timeline-card">
                <div className="timeline-top">
                  <div className="field-stack">
                    <span className="timeline-index">{index + 1}</span>
                    <h3 className="card-title">{slot.place.name}</h3>
                    <p className="helper">{slot.place.address ?? 'Singapore'}</p>
                  </div>
                  <div className="pill-row">
                    <span className="status-pill">{slot.subgroup}</span>
                    {slot.travelMinutes !== undefined && <span className="status-pill">{slot.travelMinutes} min travel</span>}
                  </div>
                </div>

                <p className="meta">
                  {formatClock(slot.arrivalTime)} - {formatClock(slot.departureTime)}. Requested slot type: {slot.slotType ?? 'Unknown'}.
                  Rating: {slot.place.rating?.toFixed(1) ?? 'N/A'}.
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
