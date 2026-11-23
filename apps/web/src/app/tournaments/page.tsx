import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusBadge, formatDate } from "@/components/tournament-status";
import type { Tournament } from "@/lib/api/models";
import { getPublicTournaments } from "@/lib/api/public";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Tournois · EPIck'em" };

function TournamentCards({ list }: { list: Tournament[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {list.map((t) => (
        <li key={t.id} className="flex flex-col gap-2 rounded-md border-2 p-4">
          <h3 className="text-xl font-bold">
            <Link
              href={routes.tournament(t.slug)}
              className="underline underline-offset-4"
            >
              {t.name}
            </Link>
          </h3>
          <p>
            {t.game.name} · début {formatDate(t.startsAt)}
          </p>
          <p>
            <StatusBadge status={t.status} />
          </p>
        </li>
      ))}
    </ul>
  );
}

async function Tournaments() {
  // Read at request time, not at build time when the API is not there;
  // the answer is still cached between visitors
  await connection();
  const all = await getPublicTournaments();
  const running = all.filter((t) => t.status === "running");
  const finished = all.filter((t) => t.status === "finished");
  if (!all.length) {
    return <p>Aucun tournoi pour l&apos;instant. Reviens bientôt.</p>;
  }
  return (
    <>
      <section
        aria-labelledby="running-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="running-heading" className="text-2xl font-bold">
          En cours
        </h2>
        {running.length ? (
          <TournamentCards list={running} />
        ) : (
          <p>Aucun tournoi en cours.</p>
        )}
      </section>
      {finished.length > 0 && (
        <section
          aria-labelledby="finished-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="finished-heading" className="text-2xl font-bold">
            Terminés
          </h2>
          <TournamentCards list={finished} />
        </section>
      )}
    </>
  );
}

// Public: anyone follows the tournaments, without signing in
export default function TournamentsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12">
      <h1 className="text-3xl font-bold">Tournois</h1>
      <Suspense fallback={<p>Chargement des tournois…</p>}>
        <Tournaments />
      </Suspense>
    </main>
  );
}
