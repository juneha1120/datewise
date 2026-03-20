import Link from 'next/link';

const links = [
  ['Plan your date', '/planner'],
  ['Login', '/login'],
  ['Profile', '/profile'],
  ['Public itineraries', '/public'],
  ['Saved itineraries', '/saved'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <section className="w-full max-w-3xl space-y-8 text-center">
        <h1 className="text-6xl font-bold">Datewise</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded border border-slate-700 p-4 text-lg font-semibold">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
