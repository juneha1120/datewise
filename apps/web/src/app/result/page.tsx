import Link from 'next/link';

export default function ResultPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Itinerary Result</h1>
      <p>Generate an itinerary from the planner to view results there.</p>
      <Link href="/planner">Open planner</Link>
    </main>
  );
}
