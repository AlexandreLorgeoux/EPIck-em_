"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Tournament } from "@/lib/api/models";
import { routes } from "@/lib/routes";
import { StatusBadge, formatDate } from "@/components/tournament-status";
import { ErrorMessage } from "@/components/messages";

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
        <h1 className="display">Tournois</h1>
        <Link
          href={routes.admin.newTournament}
          className="oc-btn oc-btn--primary"
        >
          Créer un tournoi
        </Link>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!error && !tournaments && <p>Chargement des tournois…</p>}
      {tournaments?.length === 0 && (
        <p>Aucun tournoi pour l&apos;instant. Crée le premier.</p>
      )}

      {!!tournaments?.length && (
        <table className="oc-table">
          <caption className="sr-only">
            Tous les tournois, brouillons compris
          </caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Jeu</th>
              <th scope="col">Début</th>
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t.id}>
                <th scope="row" className="font-normal">
                  <Link
                    href={routes.admin.tournament(t.id)}
                    className="font-bold underline underline-offset-4"
                  >
                    {t.name}
                  </Link>
                </th>
                <td>{t.game.name}</td>
                <td>{formatDate(t.startsAt)}</td>
                <td>
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
