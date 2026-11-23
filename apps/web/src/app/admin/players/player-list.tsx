"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { controlClass } from "@/components/form-field";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Player } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";
import { ErrorMessage } from "@/components/messages";

export function PlayerList() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const searchId = useId();

  useEffect(() => {
    api
      .get<Player[]>("/players")
      .then(setPlayers)
      .catch((caught: unknown) =>
        setError(
          isApiError(caught)
            ? explainMessage(caught.message)
            : "Impossible de charger les joueurs. Réessaie dans un instant.",
        ),
      );
  }, []);

  const query = search.trim().toLowerCase();
  const shown = (players ?? []).filter(
    (p) =>
      !query ||
      p.handle.toLowerCase().includes(query) ||
      p.team?.name.toLowerCase().includes(query),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display">Joueurs</h1>
        <Link href={routes.admin.newPlayer} className="oc-btn oc-btn--primary">
          Créer un joueur
        </Link>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!error && !players && <p>Chargement des joueurs…</p>}
      {players?.length === 0 && (
        <p>Aucun joueur pour l&apos;instant. Crée le premier.</p>
      )}

      {!!players?.length && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={searchId} className="oc-field__label">
              Rechercher un joueur ou une équipe
            </label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${controlClass} max-w-sm`}
            />
          </div>
          <p role="status">
            {shown.length === players.length
              ? `${players.length} joueur${players.length > 1 ? "s" : ""}`
              : `${shown.length} joueur${shown.length > 1 ? "s" : ""} sur ${players.length}`}
          </p>
          {shown.length > 0 && (
            <table className="oc-table">
              <thead>
                <tr>
                  <th scope="col">Pseudo</th>
                  <th scope="col">Équipe</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((player) => (
                  <tr key={player.id}>
                    <th scope="row" className="font-normal">
                      <Link
                        href={routes.admin.player(player.id)}
                        className="font-bold underline underline-offset-4"
                      >
                        {player.handle}
                      </Link>
                    </th>
                    <td>
                      {player.team ? (
                        <Link
                          href={routes.admin.team(player.team.id)}
                          className="underline underline-offset-4"
                        >
                          {player.team.name}
                        </Link>
                      ) : (
                        "Sans équipe"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
