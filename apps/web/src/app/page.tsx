import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page-stack">
      <section className="hero">
        <div className="field-stack">
          <p className="eyebrow">MVP v1</p>
          <h1 className="display-title">Build a full Singapore date in minutes.</h1>
          <p className="lede">
            Pick a starting point, set the time, choose between 2 and 4 date slots, and let Datewise generate a practical route that respects
            category preferences, opening hours, and travel distance.
          </p>
        </div>

        <div className="actions">
          <Link href="/planner" className="button-primary">Start planning</Link>
          <Link href="/public" className="button-secondary">Browse public itineraries</Link>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card">
          <p className="eyebrow">Builder</p>
          <h2 className="card-title">Ordered slots with real constraints</h2>
          <p className="section-copy">Reorder date stops, mix core groups and subgroups, and block categories you do not want.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Results</p>
          <h2 className="card-title">Generated timeline with regeneration</h2>
          <p className="section-copy">Swap a single stop or regenerate the full plan while keeping the rest of your structure intact.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Library</p>
          <h2 className="card-title">Private saves and public discovery</h2>
          <p className="section-copy">Save your own routes, publish the best ones, and keep copied public snapshots even if the original changes.</p>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Core pages</p>
            <h2 className="page-title">Everything from the spec is wired in</h2>
          </div>
        </div>
        <div className="actions">
          <Link href="/planner" className="button-primary">Generate itinerary</Link>
          <Link href="/saved" className="button-secondary">View saved</Link>
          <Link href="/profile" className="button-secondary">Open profile</Link>
          <Link href="/login" className="button-ghost">Login or sign up</Link>
        </div>
      </section>
    </main>
  );
}
