import Link from 'next/link';

export default function SavedPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Saved Itineraries</h1>
      <p>Use the Profile page to load your saved and generated itineraries.</p>
      <Link href="/profile">Go to profile</Link>
    </main>
  );
}
