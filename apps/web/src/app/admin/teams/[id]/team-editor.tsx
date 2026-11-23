"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { buttonClass } from "@/components/styles";
import { controlClass } from "@/components/form-field";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Player, Team } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";
import { TeamForm } from "../team-form";
import { ErrorMessage } from "@/components/messages";

const messageOf = (caught: unknown) =>
  isApiError(caught)
    ? explainMessage(caught.message)
    : "L'action a échoué. Réessaie dans un instant.";

// One team: its name and tag, its players and captain, and its deletion
export function TeamEditor({ id }: { id: string }) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const ids = {
    player: useId(),
    substitute: useId(),
    role: useId(),
    captain: useId(),
  };

  useEffect(() => {
    Promise.all([api.get<Team>(`/teams/${id}`), api.get<Player[]>("/players")])
      .then(([t, list]) => {
        setTeam(t);
        setPlayers(list);
      })
      .catch((caught: unknown) => setLoadError(messageOf(caught)));
  }, [id]);

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

  // Players move between teams: reload them after a membership change
  const reloadPlayers = async () =>
    setPlayers(await api.get<Player[]>("/players"));

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const playerId = String(form.get("playerId") ?? "");
    if (!playerId) return;
    const role = String(form.get("role") ?? "").trim();
    run(async () => {
      setTeam(
        await api.post<Team>(`/teams/${id}/members`, {
          playerId,
          isSubstitute: form.get("isSubstitute") === "on",
          role: role || undefined,
        }),
      );
      await reloadPlayers();
      const handle = players.find((p) => p.id === playerId)?.handle;
      return `${handle} ajouté à l'équipe.`;
    });
  }

  const removeMember = (playerId: string, handle: string) =>
    run(async () => {
      setTeam(await api.delete<Team>(`/teams/${id}/members/${playerId}`));
      await reloadPlayers();
      return `${handle} retiré de l'équipe.`;
    });

  function setCaptain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const captainPlayerId =
      String(new FormData(event.currentTarget).get("captain") ?? "") || null;
    run(async () => {
      const updated = await api.patch<Team>(`/teams/${id}`, {
        captainPlayerId,
      });
      setTeam(updated);
      const captain = updated.members.find((m) => m.id === captainPlayerId);
      return captain
        ? `${captain.handle} est le capitaine.`
        : "L'équipe n'a plus de capitaine.";
    });
  }

  const remove = () =>
    run(async () => {
      await api.delete(`/teams/${id}`);
      router.push(routes.admin.teams);
      return `Équipe ${team?.name} supprimée.`;
    });

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorMessage>{loadError}</ErrorMessage>
      </div>
    );
  }
  if (!team) {
    return (
      <p className="px-4 py-12 text-center">Chargement de l&apos;équipe…</p>
    );
  }

  // A player belongs to one team at a time
  const free = players.filter((p) => !p.team);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12">
      <Link href={routes.admin.teams} className="underline underline-offset-4">
        Retour aux équipes
      </Link>
      <h1 className="display">
        {team.name}
        {team.tag && <span className="font-normal"> [{team.tag}]</span>}
      </h1>

      <p role="status" className="sr-only">
        {notice}
      </p>
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <section
        aria-labelledby="identity-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="identity-heading" className="title">
          Nom et tag
        </h2>
        <TeamForm
          // A new key resets the fields to the saved values
          key={`${team.name}|${team.tag}`}
          team={team}
          submitLabel="Enregistrer"
          onSubmit={async (values) => {
            setTeam(
              await api.patch<Team>(`/teams/${id}`, {
                name: values.name,
                tag: values.tag.trim() || null,
              }),
            );
            setError("");
            setNotice("Nom et tag enregistrés.");
          }}
        />
      </section>

      <section
        aria-labelledby="members-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="members-heading" className="title">
          Joueurs ({team.members.length})
        </h2>
        {team.members.length === 0 ? (
          <p>Aucun joueur dans cette équipe.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {team.members.map((member) => (
              <li
                key={member.id}
                className="oc-card flex flex-wrap items-center gap-3"
              >
                <span className="grow">
                  <span className="font-bold">{member.handle}</span>
                  {[
                    member.id === team.captainPlayerId && "capitaine",
                    member.isSubstitute && "remplaçant",
                    member.role,
                  ]
                    .filter(Boolean)
                    .map((label) => ` · ${label}`)}
                </span>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={pending}
                  aria-label={`Retirer ${member.handle}`}
                  onClick={() => removeMember(member.id, member.handle)}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addMember} className="oc-card">
          <h3 className="heading">Ajouter un joueur</h3>
          {free.length === 0 ? (
            <p>
              Tous les joueurs ont déjà une équipe.{" "}
              <Link
                href={routes.admin.newPlayer}
                className="underline underline-offset-4"
              >
                Créer un joueur
              </Link>
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.player} className="oc-field__label">
                  Joueur
                </label>
                <p id={`${ids.player}-hint`}>
                  Seuls les joueurs sans équipe sont proposés.
                </p>
                <select
                  id={ids.player}
                  name="playerId"
                  aria-describedby={`${ids.player}-hint`}
                  className={controlClass}
                >
                  {free.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.handle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={ids.role} className="oc-field__label">
                  Rôle <span className="font-normal">(facultatif)</span>
                </label>
                <input
                  id={ids.role}
                  name="role"
                  maxLength={32}
                  className={controlClass}
                />
              </div>
              <label
                htmlFor={ids.substitute}
                className="flex min-h-11 items-center gap-2"
              >
                <input
                  id={ids.substitute}
                  name="isSubstitute"
                  type="checkbox"
                />
                Remplaçant
              </label>
              <button
                type="submit"
                className={`${buttonClass} self-start`}
                disabled={pending}
              >
                Ajouter le joueur
              </button>
            </>
          )}
        </form>

        {team.members.length > 0 && (
          <form
            onSubmit={setCaptain}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.captain} className="oc-field__label">
                Capitaine
              </label>
              <select
                id={ids.captain}
                name="captain"
                defaultValue={team.captainPlayerId ?? ""}
                key={team.captainPlayerId ?? "none"}
                className={controlClass}
              >
                <option value="">Aucun capitaine</option>
                {team.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.handle}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonClass} disabled={pending}>
              Changer de capitaine
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="delete-heading" className="flex flex-col gap-4">
        <h2 id="delete-heading" className="title">
          Supprimer l&apos;équipe
        </h2>
        <ConfirmAction
          label="Supprimer l'équipe"
          question={`Supprimer ${team.name} ?`}
          confirmLabel="Supprimer définitivement"
          disabled={pending}
          onConfirm={remove}
        >
          <p>
            Ses joueurs restent dans la liste des joueurs, sans équipe. Une
            équipe inscrite à un tournoi ne peut pas être supprimée.
          </p>
        </ConfirmAction>
      </section>
    </div>
  );
}
