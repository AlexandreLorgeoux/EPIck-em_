"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField, controlClass } from "@/components/form-field";
import { primaryButtonClass } from "@/components/styles";
import { api } from "@/lib/api/client";
import type { Tournament } from "@/lib/api/models";
import { useApiForm } from "@/lib/forms/use-api-form";
import { routes } from "@/lib/routes";
import { ErrorMessage } from "@/components/messages";

const labels = {
  name: "Nom",
  game: "Jeu",
  description: "Description",
  startsAt: "Début",
  endsAt: "Fin prévue",
};

// A datetime-local value is in the visitor's time zone, without offset
const toIso = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

export function TournamentForm() {
  const router = useRouter();
  const form = useApiForm(labels);
  const { fieldErrors: errors } = form;

  const submit = form.onSubmit(async (values) => {
    const created = await api.post<Tournament>("/tournaments", {
      name: values.name,
      game: values.game,
      description: values.description || undefined,
      startsAt: toIso(values.startsAt),
      endsAt: toIso(values.endsAt),
    });
    router.push(routes.admin.tournament(created.id));
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <Link
        href={routes.admin.tournaments}
        className="underline underline-offset-4"
      >
        Retour aux tournois
      </Link>
      <h1 className="display">Créer un tournoi</h1>
      <p>
        Le tournoi est créé en brouillon : il reste invisible au public
        jusqu&apos;à la génération de l&apos;arbre.
      </p>

      <form
        id={form.id}
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          label={labels.name}
          hint="Entre 3 et 80 caractères"
          error={errors.name}
        >
          {(props) => (
            <input {...props} name="name" required className={controlClass} />
          )}
        </FormField>
        <FormField
          label={labels.game}
          hint="Un jeu qui n'existe pas encore est créé"
          error={errors.game}
        >
          {(props) => (
            <input {...props} name="game" required className={controlClass} />
          )}
        </FormField>
        <FormField
          label={labels.description}
          optional
          error={errors.description}
        >
          {(props) => (
            <textarea
              {...props}
              name="description"
              rows={4}
              className={`${controlClass} py-2`}
            />
          )}
        </FormField>
        <FormField label={labels.startsAt} optional error={errors.startsAt}>
          {(props) => (
            <input
              {...props}
              name="startsAt"
              type="datetime-local"
              className={controlClass}
            />
          )}
        </FormField>
        <FormField label={labels.endsAt} optional error={errors.endsAt}>
          {(props) => (
            <input
              {...props}
              name="endsAt"
              type="datetime-local"
              className={controlClass}
            />
          )}
        </FormField>

        {form.formError && <ErrorMessage>{form.formError}</ErrorMessage>}

        <button
          type="submit"
          disabled={form.pending}
          className={primaryButtonClass}
        >
          {form.pending ? "Création…" : "Créer le tournoi"}
        </button>
      </form>
    </div>
  );
}
