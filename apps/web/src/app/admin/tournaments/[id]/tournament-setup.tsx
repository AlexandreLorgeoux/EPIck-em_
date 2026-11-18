"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type {
  SeedingMode,
  Team,
  Tournament,
  TournamentTeam,
} from "@/lib/api/models";
import { routes } from "@/lib/routes";
import { StatusBadge, formatDate } from "../tournament-status";

const messageOf = (caught: unknown) =>
  isApiError(caught)
    ? caught.message
    : "L'action a échoué. Réessaie dans un instant.";

const button =
  "min-h-11 rounded-md border-2 px-4 font-bold disabled:opacity-50";

// Setup of one tournament: its teams, their seeding and the bracket.
// Everything can change while it is a draft; generating the bracket starts
// the tournament and freezes the rest.
export function TournamentSetup({ id }: { id: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  // Team ids, best seed first, while the admin orders them by hand
  const [order, setOrder] = useState<string[]>([]);
  const [mode, setMode] = useState<SeedingMode>("auto");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  // Said politely by screen readers after each change
  const [notice, setNotice] = useState("");
  const ids = { pick: useId(), confirm: useId() };
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  // Set on cancel: the generate button is back only after the next render
  const returnFocus = useRef(false);

  const showTeams = useCallback((list: TournamentTeam[]) => {
    setTeams(list);
    setOrder(list.map((t) => t.id));
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<Tournament>(`/tournaments/${id}`),
      api.get<TournamentTeam[]>(`/tournaments/${id}/teams`),
      api.get<Team[]>("/teams"),
    ])
      .then(([t, list, all]) => {
        setTournament(t);
        showTeams(list);
        setAllTeams(all);
        // Seeds already saved mean the admin was ordering by hand
        if (list.some((team) => team.seed !== null)) setMode("manual");
      })
      .catch((caught: unknown) => setLoadError(messageOf(caught)));
  }, [id, showTeams]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      generateRef.current?.focus();
    }
  }, [confirming]);

  // Runs one change, shows its error, and says what happened on success
  async function run(action: () => Promise<string>) {
    setPending(true);
    setError("");
    try {
      setNotice(await action());
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(false);
    }
  }

  const nameOf = (teamId: string) =>
    teams.find((t) => t.id === teamId)?.name ?? "";

  const addTeam = (teamId: string) =>
    run(async () => {
      showTeams(
        await api.post<TournamentTeam[]>(`/tournaments/${id}/teams`, {
          teamId,
        }),
      );
      return `${allTeams.find((t) => t.id === teamId)?.name} ajoutée au tournoi.`;
    });

  const removeTeam = (team: TournamentTeam) =>
    run(async () => {
      await api.delete(`/tournaments/${id}/teams/${team.id}`);
      showTeams(await api.get<TournamentTeam[]>(`/tournaments/${id}/teams`));
      return `${team.name} retirée du tournoi.`;
    });

  function move(index: number, delta: -1 | 1) {
    const next = [...order];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setOrder(next);
    setNotice(`${nameOf(moved)} est tête de série ${index + delta + 1}.`);
  }

  const saveSeeding = () =>
    api.put<TournamentTeam[]>(`/tournaments/${id}/seeding`, {
      teamIds: order,
    });

  const generate = () =>
    run(async () => {
      setConfirming(false);
      if (mode === "manual") showTeams(await saveSeeding());
      await api.post(`/tournaments/${id}/bracket`, { seeding: mode });
      const [t, list] = await Promise.all([
        api.get<Tournament>(`/tournaments/${id}`),
        api.get<TournamentTeam[]>(`/tournaments/${id}/teams`),
      ]);
      setTournament(t);
      showTeams(list);
      return "Arbre généré : le tournoi est en cours.";
    });

  function cancel() {
    returnFocus.current = true;
    setConfirming(false);
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p role="alert">{loadError}</p>
      </main>
    );
  }
  if (!tournament) {
    return <p className="px-4 py-16 text-center">Chargement du tournoi…</p>;
  }

  const draft = tournament.status === "draft";
  const registered = new Set(teams.map((t) => t.id));
  const available = allTeams.filter((t) => !registered.has(t.id));
  const ordered = order
    .map((teamId) => teams.find((t) => t.id === teamId))
    .filter((t): t is TournamentTeam => !!t);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <Link
        href={routes.admin.tournaments}
        className="underline underline-offset-4"
      >
        Retour aux tournois
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{tournament.name}</h1>
        <p className="flex flex-wrap items-center gap-3">
          <span>Statut :</span> <StatusBadge status={tournament.status} />
        </p>
        <p>
          {tournament.game.name} · début {formatDate(tournament.startsAt)}
        </p>
      </header>

      <p role="status" className="sr-only">
        {notice}
      </p>
      {error && <p role="alert">{error}</p>}

      {!draft && (
        <p>
          Le tournoi a démarré : les équipes et le seeding ne peuvent plus
          changer.
        </p>
      )}

      <section aria-labelledby="teams-heading" className="flex flex-col gap-4">
        <h2 id="teams-heading" className="text-2xl font-bold">
          Équipes ({teams.length})
        </h2>

        {draft && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const teamId = String(
                new FormData(event.currentTarget).get("teamId") ?? "",
              );
              if (teamId) addTeam(teamId);
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.pick} className="font-bold">
                Équipe à ajouter
              </label>
              <select
                id={ids.pick}
                name="teamId"
                className="min-h-11 rounded-md border-2 px-3"
                disabled={!available.length}
              >
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.tag ? ` [${t.tag}]` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className={button}
              disabled={pending || !available.length}
            >
              Ajouter
            </button>
            {!available.length && (
              <p className="w-full">Toutes les équipes sont déjà inscrites.</p>
            )}
          </form>
        )}

        {draft && teams.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="font-bold">Seeding</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="seeding"
                value="auto"
                checked={mode === "auto"}
                onChange={() => setMode("auto")}
              />
              Automatique : tirage au sort à la génération
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="seeding"
                value="manual"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />
              Manuel : je classe les équipes, la meilleure en premier
            </label>
          </fieldset>
        )}

        {teams.length === 0 ? (
          <p>Aucune équipe inscrite.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {(draft ? ordered : teams).map((team, index) => (
              <li
                key={team.id}
                className="flex flex-wrap items-center gap-3 rounded-md border-2 px-3 py-2"
              >
                <span className="grow">
                  {(!draft || mode === "manual") && (
                    <span className="font-bold">
                      {draft ? index + 1 : (team.seed ?? "—")}.{" "}
                    </span>
                  )}
                  {team.name}
                  {team.tag ? ` [${team.tag}]` : ""}
                </span>
                {draft && mode === "manual" && (
                  <>
                    <button
                      type="button"
                      className={button}
                      disabled={pending || index === 0}
                      aria-label={`Monter ${team.name}`}
                      onClick={() => move(index, -1)}
                    >
                      Monter
                    </button>
                    <button
                      type="button"
                      className={button}
                      disabled={pending || index === ordered.length - 1}
                      aria-label={`Descendre ${team.name}`}
                      onClick={() => move(index, 1)}
                    >
                      Descendre
                    </button>
                  </>
                )}
                {draft && (
                  <button
                    type="button"
                    className={button}
                    disabled={pending}
                    aria-label={`Retirer ${team.name}`}
                    onClick={() => removeTeam(team)}
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {draft && mode === "manual" && teams.length > 1 && (
          <button
            type="button"
            className={`${button} self-start`}
            disabled={pending}
            onClick={() =>
              run(async () => {
                showTeams(await saveSeeding());
                return "Ordre des têtes de série enregistré.";
              })
            }
          >
            Enregistrer l&apos;ordre
          </button>
        )}
      </section>

      {draft && (
        <section
          aria-labelledby="bracket-heading"
          className="flex flex-col gap-4"
        >
          <h2 id="bracket-heading" className="text-2xl font-bold">
            Arbre
          </h2>
          {teams.length < 2 && (
            <p>Il faut au moins 2 équipes pour générer l&apos;arbre.</p>
          )}
          {!confirming ? (
            <button
              ref={generateRef}
              type="button"
              className={`${button} self-start`}
              disabled={pending || teams.length < 2}
              onClick={() => setConfirming(true)}
            >
              Générer l&apos;arbre
            </button>
          ) : (
            <div
              role="group"
              aria-labelledby={ids.confirm}
              className="flex flex-col gap-3 rounded-md border-2 p-4"
            >
              <h3
                id={ids.confirm}
                ref={confirmRef}
                tabIndex={-1}
                className="text-xl font-bold"
              >
                Générer l&apos;arbre et démarrer le tournoi ?
              </h3>
              <p>
                Le tournoi devient public et passe en cours. Les {teams.length}{" "}
                équipes et leur seeding (
                {mode === "manual" ? "ordre ci-dessus" : "tirage au sort"}) ne
                pourront plus changer.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={button}
                  disabled={pending}
                  onClick={generate}
                >
                  Confirmer la génération
                </button>
                <button type="button" className={button} onClick={cancel}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
