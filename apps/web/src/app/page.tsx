import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <section className="w-full max-w-2xl space-y-8 text-center">
        <h1 className="text-6xl font-bold">Datewise</h1>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/planner" className="rounded border border-slate-700 p-4 text-lg font-semibold">
            Plan your date
          </Link>
          <Link href="/login" className="rounded border border-slate-700 p-4 text-lg font-semibold">
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}
