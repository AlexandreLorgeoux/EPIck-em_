"use client";

import { FormField, controlClass } from "@/components/form-field";
import { buttonClass } from "@/components/confirm-action";
import type { Player } from "@/lib/api/models";
import { useApiForm, type FormValues } from "@/lib/forms/use-api-form";

const labels = { handle: "Pseudo" };

// The pseudo of a player, to create it or edit it
export function PlayerForm({
  player,
  submitLabel,
  onSubmit,
}: {
  player?: Player;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const form = useApiForm(labels);
  return (
    <form
      id={form.id}
      onSubmit={form.onSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <FormField
        label={labels.handle}
        hint="Entre 2 et 32 caractères, le nom affiché dans les tournois"
        error={form.fieldErrors.handle}
      >
        {(props) => (
          <input
            {...props}
            name="handle"
            required
            autoComplete="off"
            defaultValue={player?.handle}
            className={controlClass}
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
