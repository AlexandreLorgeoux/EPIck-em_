"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { controlClass } from "@/components/form-field";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Team } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";

export function TeamList() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const searchId = useId();

  useEffect(() => {
    api
      .get<Team[]>("/teams")
      .then(setTeams)
      .catch((caught: unknown) =>
        setError(
          isApiError(caught)
            ? explainMessage(caught.message)
            : "Impossible de charger les équipes. Réessaie dans un instant.",
        ),
      );
  }, []);

  const query = search.trim().toLowerCase();
  const shown = (teams ?? []).filter(
    (t) =>
      !query ||
      t.name.toLowerCase().includes(query) ||
      t.tag?.toLowerCase().includes(query),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Équipes</h1>
        <Link
          href={routes.admin.newTeam}
          className="inline-flex min-h-11 items-center rounded-md border-2 px-4 font-bold"
        >
          Créer une équipe
        </Link>
      </div>

      {error && <p role="alert">{error}</p>}
      {!error && !teams && <p>Chargement des équipes…</p>}
      {teams?.length === 0 && (
        <p>Aucune équipe pour l&apos;instant. Crée la première.</p>
      )}

      {!!teams?.length && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={searchId} className="font-bold">
              Rechercher une équipe
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
            {shown.length === teams.length
              ? `${teams.length} équipe${teams.length > 1 ? "s" : ""}`
              : `${shown.length} équipe${shown.length > 1 ? "s" : ""} sur ${teams.length}`}
          </p>
          {shown.length > 0 && (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2">
                  <th scope="col" className="py-2 pr-4">
                    Nom
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Tag
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Joueurs
                  </th>
                  <th scope="col" className="py-2">
                    Capitaine
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((team) => (
                  <tr key={team.id} className="border-b">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <Link
                        href={routes.admin.team(team.id)}
                        className="font-bold underline underline-offset-4"
                      >
                        {team.name}
                      </Link>
                    </th>
                    <td className="py-3 pr-4">{team.tag ?? "—"}</td>
                    <td className="py-3 pr-4">{team.members.length}</td>
                    <td className="py-3">
                      {team.members.find((m) => m.id === team.captainPlayerId)
                        ?.handle ?? "—"}
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
