import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LeaderboardBoard } from "@/components/leaderboard/leaderboard-board";
import { TournamentNav } from "@/components/tournament-nav";
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
    title: data ? `Classement · ${data.tournament.name}` : "Classement",
  };
}

async function Ranking({ params }: { params: Params }) {
  const { slug } = await params;
  await connection();
  const data = await getPublicTournament(slug);
  if (!data) notFound();
  return (
    <>
      <h1 className="display break-words">{data.tournament.name}</h1>
      <TournamentNav slug={slug} current="leaderboard" />
      <LeaderboardBoard tournamentId={data.tournament.id} slug={slug} />
    </>
  );
}

// Public: anyone follows the ranking; a signed-in user sees their own place
export default function LeaderboardPage({
  params,
}: PageProps<"/tournaments/[slug]/leaderboard">) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12">
      <Link href={routes.tournaments} className="underline underline-offset-4">
        Tous les tournois
      </Link>
      <Suspense fallback={<p>Chargement du classement…</p>}>
        <Ranking params={params} />
      </Suspense>
    </div>
  );
}
