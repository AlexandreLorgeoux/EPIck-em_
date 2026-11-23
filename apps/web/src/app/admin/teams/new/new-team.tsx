"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { Team } from "@/lib/api/models";
import { routes } from "@/lib/routes";
import { TeamForm } from "../team-form";

export function NewTeam() {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <Link href={routes.admin.teams} className="underline underline-offset-4">
        Retour aux équipes
      </Link>
      <h1 className="display">Créer une équipe</h1>
      <TeamForm
        submitLabel="Créer l'équipe"
        onSubmit={async (values) => {
          const team = await api.post<Team>("/teams", {
            name: values.name,
            tag: values.tag || undefined,
          });
          // Next step: choose its players
          router.push(routes.admin.team(team.id));
        }}
      />
    </div>
  );
}
