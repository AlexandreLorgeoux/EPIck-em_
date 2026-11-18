"use client";

import { FormField, controlClass } from "@/components/form-field";
import { buttonClass } from "@/components/confirm-action";
import type { Team } from "@/lib/api/models";
import { useApiForm, type FormValues } from "@/lib/forms/use-api-form";

const labels = { name: "Nom", tag: "Tag" };

// Name and tag of a team, to create it or edit it
export function TeamForm({
  team,
  submitLabel,
  onSubmit,
}: {
  team?: Team;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useApiForm(labels);
  const errors = form.fieldErrors;
  return (
    <form
      id={form.id}
      onSubmit={form.onSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormField
        label={labels.name}
        hint="Entre 2 et 64 caractères"
        error={errors.name}
      >
        {(props) => (
          <input
            {...props}
            name="name"
            required
            defaultValue={team?.name}
            className={controlClass}
          />
        )}
      </FormField>
      <FormField
        label={labels.tag}
        hint="Abréviation de 1 à 8 caractères, par exemple MRM"
        optional
        error={errors.tag}
      >
        {(props) => (
          <input
            {...props}
            name="tag"
            defaultValue={team?.tag ?? ""}
            className={`${controlClass} max-w-40`}
          />
        )}
      </FormField>
      {form.formError && <p role="alert">{form.formError}</p>}
      <button type="submit" disabled={form.pending} className={buttonClass}>
        {form.pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
