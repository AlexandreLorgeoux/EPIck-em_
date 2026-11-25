"use client";

import { FormField, controlClass } from "@/components/form-field";
import { primaryButtonClass } from "@/components/styles";
import type { Player } from "@/lib/api/models";
import { useApiForm, type FormValues } from "@/lib/forms/use-api-form";
import { ErrorMessage } from "@/components/messages";

const labels = { handle: "Pseudo" };

// The pseudo of a player, to create it or edit it
export function PlayerForm({
  player,
  submitLabel,
  onSubmit,
}: {
  player?: Player;
  submitLabel: string;
  // Resolves to the message of the success toast
  onSubmit: (values: FormValues) => Promise<string | void>;
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
      {form.formError && (
        <ErrorMessage announce={false}>{form.formError}</ErrorMessage>
      )}
      <button
        type="submit"
        disabled={form.pending}
        className={primaryButtonClass}
      >
        {form.pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
