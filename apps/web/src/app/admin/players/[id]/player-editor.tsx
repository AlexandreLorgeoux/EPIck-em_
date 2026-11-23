"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Player } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";
import { PlayerForm } from "../player-form";
import { ErrorMessage } from "@/components/messages";

const messageOf = (caught: unknown) =>
  isApiError(caught)
    ? explainMessage(caught.message)
    : "L'action a échoué. Réessaie dans un instant.";

export function PlayerEditor({ id }: { id: string }) {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api
      .get<Player>(`/players/${id}`)
      .then(setPlayer)
      .catch((caught: unknown) => setLoadError(messageOf(caught)));
  }, [id]);

  async function remove() {
    setError("");
    try {
      await api.delete(`/players/${id}`);
      router.push(routes.admin.players);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorMessage>{loadError}</ErrorMessage>
      </div>
    );
  }
  if (!player) {
    return <p className="px-4 py-12 text-center">Chargement du joueur…</p>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-10 px-4 py-12">
      <Link
        href={routes.admin.players}
        className="underline underline-offset-4"
      >
        Retour aux joueurs
      </Link>
      <h1 className="display">{player.handle}</h1>
      <p role="status" className="sr-only">
        {notice}
      </p>
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <p>
        {player.team ? (
          <>
            Équipe :{" "}
            <Link
              href={routes.admin.team(player.team.id)}
              className="underline underline-offset-4"
            >
              {player.team.name}
            </Link>
            {player.team.isSubstitute && " (remplaçant)"}. L&apos;équipe se
            change depuis la page de l&apos;équipe.
          </>
        ) : (
          "Sans équipe. On l'ajoute à une équipe depuis la page de l'équipe."
        )}
      </p>

      <section aria-labelledby="handle-heading" className="flex flex-col gap-4">
        <h2 id="handle-heading" className="title">
          Changer le pseudo
        </h2>
        <PlayerForm
          key={player.handle}
          player={player}
          submitLabel="Enregistrer"
          onSubmit={async (values) => {
            setPlayer(
              await api.patch<Player>(`/players/${id}`, {
                handle: values.handle,
              }),
            );
            setNotice("Pseudo enregistré.");
          }}
        />
      </section>

      <section aria-labelledby="delete-heading" className="flex flex-col gap-4">
        <h2 id="delete-heading" className="title">
          Supprimer le joueur
        </h2>
        <ConfirmAction
          label="Supprimer le joueur"
          question={`Supprimer ${player.handle} ?`}
          confirmLabel="Supprimer définitivement"
          onConfirm={remove}
        >
          <p>
            Le joueur quitte son équipe. Un joueur inscrit à un tournoi ne peut
            pas être supprimé.
          </p>
        </ConfirmAction>
      </section>
    </div>
  );
}
