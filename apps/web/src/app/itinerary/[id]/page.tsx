import Link from 'next/link';

export default async function ItineraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-3xl font-bold">Itinerary Detail</h1>
      <p>Itinerary ID: {id}</p>
      <p>Detailed snapshots are available in profile saved copies.</p>
      <Link href="/profile">Open profile</Link>
    </main>
  );
}
