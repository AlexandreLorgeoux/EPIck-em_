"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { controlClass } from "@/components/form-field";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Team } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";
import { ErrorMessage } from "@/components/messages";

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
        <h1 className="display">Équipes</h1>
        <Link href={routes.admin.newTeam} className="oc-btn oc-btn--primary">
          Créer une équipe
        </Link>
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!error && !teams && <p>Chargement des équipes…</p>}
      {teams?.length === 0 && (
        <p>Aucune équipe pour l&apos;instant. Crée la première.</p>
      )}

      {!!teams?.length && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={searchId} className="oc-field__label">
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
            <table className="oc-table">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Tag</th>
                  <th scope="col">Joueurs</th>
                  <th scope="col">Capitaine</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((team) => (
                  <tr key={team.id}>
                    <th scope="row" className="font-normal">
                      <Link
                        href={routes.admin.team(team.id)}
                        className="font-bold underline underline-offset-4"
                      >
                        {team.name}
                      </Link>
                    </th>
                    <td>{team.tag ?? "—"}</td>
                    <td>{team.members.length}</td>
                    <td>
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
