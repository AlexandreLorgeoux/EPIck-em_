"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { Player } from "@/lib/api/models";
import { routes } from "@/lib/routes";
import { PlayerForm } from "../player-form";

export function NewPlayer() {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <Link
        href={routes.admin.players}
        className="underline underline-offset-4"
      >
        Retour aux joueurs
      </Link>
      <h1 className="text-3xl font-bold">Créer un joueur</h1>
      <PlayerForm
        submitLabel="Créer le joueur"
        onSubmit={async (values) => {
          await api.post<Player>("/players", { handle: values.handle });
          router.push(routes.admin.players);
        }}
      />
    </div>
  );
}
