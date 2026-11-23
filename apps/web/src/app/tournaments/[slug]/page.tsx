import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BracketSwitcher } from "@/components/bracket/bracket-switcher";
import { championOf } from "@/components/bracket/bracket-text";
import { StatusBadge, formatDate } from "@/components/tournament-status";
import { getPublicTournament } from "@/lib/api/public";
import { routes } from "@/lib/routes";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const data = await getPublicTournament((await params).slug);
  return {
    title: data ? `${data.tournament.name} · EPIck'em` : "Tournoi · EPIck'em",
  };
}

async function Tournament({ params }: { params: Params }) {
  const { slug } = await params;
  await connection();
  const data = await getPublicTournament(slug);
  if (!data) notFound();
  const { tournament, bracket } = data;
  const winner = bracket && championOf(bracket);

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        <p className="flex flex-wrap items-center gap-3">
          <span>Statut :</span> <StatusBadge status={tournament.status} />
        </p>
        <p>
          {tournament.game.name} · début {formatDate(tournament.startsAt)}
          {tournament.endsAt &&
            ` · fin prévue ${formatDate(tournament.endsAt)}`}
        </p>
        {tournament.description && <p>{tournament.description}</p>}
      </header>

      {winner && (
        <p className="rounded-md border-4 border-double p-4 text-xl font-bold">
          <span aria-hidden="true">🏆 </span>
          {winner} remporte le tournoi.
        </p>
      )}

      <section
        aria-labelledby="results-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="results-heading" className="text-2xl font-bold">
          Matchs et résultats
        </h2>
        {bracket ? (
          <BracketSwitcher bracket={bracket} />
        ) : (
          <p>L&apos;arbre n&apos;est pas encore généré.</p>
        )}
      </section>
    </>
  );
}

// Public and read-only: anyone follows a running or finished tournament.
// Rendered on the server from cached data, refreshed after each result.
export default function TournamentPage({
  params,
}: PageProps<"/tournaments/[slug]">) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12">
      <Link href={routes.tournaments} className="underline underline-offset-4">
        Tous les tournois
      </Link>
      <Suspense fallback={<p>Chargement du tournoi…</p>}>
        <Tournament params={params} />
      </Suspense>
    </main>
  );
}
