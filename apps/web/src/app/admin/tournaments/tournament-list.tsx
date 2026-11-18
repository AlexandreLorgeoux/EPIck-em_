"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Tournament } from "@/lib/api/models";
import { routes } from "@/lib/routes";
import { StatusBadge, formatDate } from "./tournament-status";

export function TournamentList() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Tournament[]>("/tournaments")
      .then(setTournaments)
      .catch((caught: unknown) =>
        setError(
          isApiError(caught)
            ? caught.message
            : "Impossible de charger les tournois. Réessaie dans un instant.",
        ),
      );
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Tournois</h1>
        <Link
          href={routes.admin.newTournament}
          className="inline-flex min-h-11 items-center rounded-md border-2 px-4 font-bold"
        >
          Créer un tournoi
        </Link>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && !tournaments && <p>Chargement des tournois…</p>}
      {tournaments?.length === 0 && (
        <p>Aucun tournoi pour l&apos;instant. Crée le premier.</p>
      )}

      {!!tournaments?.length && (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Tous les tournois, brouillons compris
          </caption>
          <thead>
            <tr className="border-b-2">
              <th scope="col" className="py-2 pr-4">
                Nom
              </th>
              <th scope="col" className="py-2 pr-4">
                Jeu
              </th>
              <th scope="col" className="py-2 pr-4">
                Début
              </th>
              <th scope="col" className="py-2">
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.id} className="border-b">
                <th scope="row" className="py-3 pr-4 font-normal">
                  <Link
                    href={routes.admin.tournament(t.id)}
                    className="font-bold underline underline-offset-4"
                  >
                    {t.name}
                  </Link>
                </th>
                <td className="py-3 pr-4">{t.game.name}</td>
                <td className="py-3 pr-4">{formatDate(t.startsAt)}</td>
                <td className="py-3">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
