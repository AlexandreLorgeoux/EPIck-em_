import type { Metadata } from "next";
import { Suspense } from "react";
import { TournamentSetup } from "./tournament-setup";

export const metadata: Metadata = { title: "Tournoi · Administration" };

// The id is only known at request time: read it under Suspense so the rest
// of the page can still be prerendered (Cache Components)
async function Setup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TournamentSetup id={id} />;
}

export default function AdminTournamentPage({
  params,
}: PageProps<"/admin/tournaments/[id]">) {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-center">Chargement…</p>}>
      <Setup params={params} />
    </Suspense>
  );
}
