import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="page-stack">
      <section className="hero hero-compact">
        <div className="field-stack">
          <p className="eyebrow">MVP v1</p>
          <h1 className="display-title">Plan a date in minutes.</h1>
          <p className="lede">Choose a start point, pick the flow, and get a Singapore route with food, activities, and drinks.</p>
        </div>

        <div className="metrics-row">
          <div className="metric">
            <strong>2-4</strong>
            <span>ordered stops</span>
          </div>
          <div className="metric">
            <strong>SG</strong>
            <span>Singapore only</span>
          </div>
          <div className="metric">
            <strong>1 tap</strong>
            <span>save or publish</span>
          </div>
        </div>

        <div className="actions">
          <Link href="/planner" className="button-primary">Start planning</Link>
          <Link href="/public" className="button-secondary">Browse public itineraries</Link>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card">
          <p className="eyebrow">Builder</p>
          <h2 className="card-title">Build the flow</h2>
          <p className="section-copy">Reorder stops and mix broad or specific categories.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Results</p>
          <h2 className="card-title">Regenerate fast</h2>
          <p className="section-copy">Swap one stop or refresh the full route.</p>
        </article>
        <article className="card">
          <p className="eyebrow">Library</p>
          <h2 className="card-title">Save and share</h2>
          <p className="section-copy">Keep private plans or save public snapshots.</p>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Explore</p>
            <h2 className="section-title section-title-lg">Jump to the main flows</h2>
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
