'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ItinerarySlot } from '@datewise/shared';
import { readLatestResult, type LatestPlannerResult } from '../../lib/latest-result';

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ResultPage() {
  const [latest, setLatest] = useState<LatestPlannerResult | null>(null);

  useEffect(() => {
    setLatest(readLatestResult());
  }, []);

  return (
    <main className="page-stack">
      <section className="hero">
        <p className="eyebrow">Latest result</p>
        <h1 className="page-title">Your most recently generated itinerary lives here too.</h1>
        <p className="lede">
          The planner is still the main generation surface, but this page now gives you a quick standalone view of the latest route generated in this browser.
        </p>
        <div className="actions">
          <Link href="/planner" className="button-primary">Open planner</Link>
        </div>
      </section>

      {!latest ? (
        <section className="panel">
          <div className="empty-state">No recent itinerary found in this browser session. Generate one from the planner first.</div>
        </section>
      ) : (
        <>
          <section className="grid-2">
            <article className="panel">
              <p className="eyebrow">Requested input</p>
              <h2 className="section-title">{latest.input.startPoint.name}</h2>
              <p className="helper">
                {latest.input.date} at {latest.input.time}
              </p>
              <p className="helper">Slots: {latest.input.slots.join(', ')}</p>
              <p className="helper">Avoided: {latest.input.avoidSlots.join(', ') || 'None'}</p>
            </article>

            <article className="panel">
              <p className="eyebrow">Snapshot</p>
              <h2 className="section-title">{new Date(latest.savedAt).toLocaleString()}</h2>
              <p className="helper">{latest.result.length} planned stops in the current browser snapshot.</p>
            </article>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Route</p>
                <h2 className="section-title">Generated stops</h2>
              </div>
            </div>

            <div className="timeline">
              {latest.result.map((slot: ItinerarySlot, index: number) => (
                <article key={`${slot.place.placeId}-${index}`} className="timeline-card">
                  <div className="timeline-top">
                    <div className="field-stack">
                      <span className="timeline-index">{index + 1}</span>
                      <h3 className="card-title">{slot.place.name}</h3>
                      <p className="helper">{slot.place.address}</p>
                    </div>
                    <div className="pill-row">
                      <span className="status-pill">{slot.subgroup}</span>
                      <span className="status-pill">{slot.travelMinutes} min travel</span>
                    </div>
                  </div>
                  <p className="meta">
                    {formatClock(slot.arrivalTime)} - {formatClock(slot.departureTime)}. Rating: {slot.place.rating?.toFixed(1) ?? 'N/A'}.
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
