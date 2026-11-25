"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/brand/icon";
import { ErrorMessage, FieldError } from "@/components/messages";
import {
  buttonClass,
  controlClass,
  primaryButtonClass,
} from "@/components/styles";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { BracketMatch, Prediction } from "@/lib/api/models";
import { useApiForm } from "@/lib/forms/use-api-form";

const labels = { teamId: "Vainqueur", score: "Score exact" };

// A score left empty is sent as null, so the API says it is missing
const toScore = (value: string) => (value === "" ? null : Number(value));

/**
 * A user's prediction on one match: the winner and, if they want, the
 * exact score. The API checks both, and whether the match is still open.
 */
export function PredictionForm({
  match,
  prediction,
  onSaved,
  onRefused,
  onCancel,
}: {
  match: BracketMatch;
  prediction?: Prediction;
  onSaved: (prediction: Prediction) => void;
  // The match locked, or changed, since the page loaded
  onRefused: () => void;
  onCancel: () => void;
}) {
  const form = useApiForm(labels);
  const errors = form.fieldErrors;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLInputElement>(
        "input[type=radio]:checked, input[type=radio]",
      )
      ?.focus();
  }, []);

  const submit = form.onSubmit(async (values) => {
    const scores = [toScore(values.score1), toScore(values.score2)];
    const score = scores.every((s) => s === null) ? null : scores;
    try {
      const saved = prediction
        ? await api.patch<Prediction>(`/predictions/${prediction.id}`, {
            teamId: values.teamId,
            score,
          })
        : await api.post<Prediction>("/predictions", {
            matchId: match.id,
            teamId: values.teamId,
            score: score ?? undefined,
          });
      onSaved(saved);
      return `Pronostic enregistré pour ${match.label}.`;
    } catch (caught) {
      if (
        isApiError(caught) &&
        (caught.status === 409 || caught.status === 404)
      )
        onRefused();
      throw caught;
    }
  });

  return (
    <form
      id={form.id}
      ref={formRef}
      onSubmit={submit}
      noValidate
      aria-label={`Pronostic sur ${match.label}`}
      className="flex flex-col gap-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        role="radiogroup"
        aria-labelledby={`${id}-winner`}
        aria-invalid={errors.teamId ? true : undefined}
        aria-describedby={errors.teamId ? `${id}-winner-error` : undefined}
        className="flex flex-col gap-2"
      >
        <p id={`${id}-winner`} className="oc-field__label">
          Qui va gagner ?
        </p>
        {match.slots.map(
          ({ team }) =>
            team && (
              <label key={team.id} className="oc-pick">
                <input
                  type="radio"
                  name="teamId"
                  value={team.id}
                  required
                  defaultChecked={prediction?.team?.id === team.id}
                  className="oc-pick__input"
                />
                <span className="oc-pick__name">{team.name}</span>
                <span className="oc-pick__chosen" aria-hidden="true">
                  <Icon name="check" />
                  Ton choix
                </span>
              </label>
            ),
        )}
        {errors.teamId && (
          <FieldError id={`${id}-winner-error`}>{errors.teamId}</FieldError>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="oc-field__label">
          Score exact <span className="font-normal">(facultatif)</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {match.slots.map(({ team, position }, i) => (
            <div key={position} className="flex min-w-0 flex-col gap-1">
              <label htmlFor={`${id}-score-${i}`} className="break-words">
                <span className="sr-only">Score de </span>
                {team?.name}
              </label>
              <input
                id={`${id}-score-${i}`}
                name={`score${i + 1}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                step={1}
                // Only kept with the pick it goes with
                defaultValue={prediction?.team ? prediction.score?.[i] : ""}
                aria-invalid={errors.score ? true : undefined}
                aria-describedby={
                  errors.score ? `${id}-score-error` : undefined
                }
                className={`${controlClass} w-full tabular-nums`}
              />
            </div>
          ))}
        </div>
        {errors.score && (
          <FieldError id={`${id}-score-error`}>{errors.score}</FieldError>
        )}
      </fieldset>

      {form.formError && (
        <ErrorMessage announce={false}>{form.formError}</ErrorMessage>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={form.pending}
        >
          {form.pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
