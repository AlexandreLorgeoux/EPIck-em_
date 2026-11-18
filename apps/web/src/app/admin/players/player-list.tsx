"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { controlClass } from "@/components/form-field";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Player } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";

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
        <h1 className="text-3xl font-bold">Joueurs</h1>
        <Link
          href={routes.admin.newPlayer}
          className="inline-flex min-h-11 items-center rounded-md border-2 px-4 font-bold"
        >
          Créer un joueur
        </Link>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && !players && <p>Chargement des joueurs…</p>}
      {players?.length === 0 && (
        <p>Aucun joueur pour l&apos;instant. Crée le premier.</p>
      )}

      {!!players?.length && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={searchId} className="font-bold">
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
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2">
                  <th scope="col" className="py-2 pr-4">
                    Pseudo
                  </th>
                  <th scope="col" className="py-2">
                    Équipe
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((player) => (
                  <tr key={player.id} className="border-b">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <Link
                        href={routes.admin.player(player.id)}
                        className="font-bold underline underline-offset-4"
                      >
                        {player.handle}
                      </Link>
                    </th>
                    <td className="py-3">
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
