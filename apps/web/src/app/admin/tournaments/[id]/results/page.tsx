import type { Metadata } from "next";
import { Suspense } from "react";
import { refreshPublicTournament } from "@/lib/api/refresh-public";
import { ResultsBoard } from "./results-board";

export const metadata: Metadata = { title: "Résultats · Administration" };

// The id is only known at request time: read it under Suspense so the rest
// of the page can still be prerendered (Cache Components)
async function Board({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsBoard id={id} onResultSaved={refreshPublicTournament} />;
}

export default function AdminResultsPage({
  params,
}: PageProps<"/admin/tournaments/[id]/results">) {
  return (
    <Suspense fallback={<p className="px-4 py-12 text-center">Chargement…</p>}>
      <Board params={params} />
    </Suspense>
  );
}
