"use client";

import { useEffect, useId, useRef } from "react";
import { buttonClass, primaryButtonClass } from "@/components/styles";
import { controlClass } from "@/components/form-field";
import { FieldError } from "@/components/messages";
import { api } from "@/lib/api/client";
import type { Bracket, BracketMatch } from "@/lib/api/models";
import { useApiForm } from "@/lib/forms/use-api-form";
import { ErrorMessage } from "@/components/messages";

const labels = {
  scores: "Score",
  winnerSlot: "Vainqueur",
  reason: "Raison de la correction",
};

// "Score d'Alpha", "Score de Delta"
const scoreLabel = (team: string) =>
  `Score ${/^[aeiouyhàâäéèêëîïôöûü]/i.test(team) ? "d'" : "de "}${team}`;

// An empty field is sent as null, so the API says it is missing
const toScore = (value: string) => (value === "" ? null : Number(value));

/**
 * The result of one match: the score of each team and the winner, checked
 * against each other by the API. A match that already has a result is
 * corrected the same way, with a reason, and the form starts from the
 * current score.
 */
export function ResultForm({
  match,
  onSaved,
  onCancel,
}: {
  match: BracketMatch;
  onSaved: (bracket: Bracket) => void;
  onCancel: () => void;
}) {
  const form = useApiForm(labels);
  const errors = form.fieldErrors;
  const ids = {
    heading: useId(),
    scores: useId(),
    winner: useId(),
    reason: useId(),
  };
  const headingRef = useRef<HTMLHeadingElement>(null);
  const correcting = match.hasResult;
  const teams = match.slots.map((slot) => slot.team?.name ?? "");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const submit = form.onSubmit(async (values) => {
    const bracket = await api.post<Bracket>(`/matches/${match.id}/result`, {
      scores: [toScore(values.score1), toScore(values.score2)],
      winnerSlot: values.winnerSlot ? Number(values.winnerSlot) : undefined,
      reason: values.reason?.trim() || undefined,
    });
    onSaved(bracket);
  });

  const describedBy = (
    field: "scores" | "winnerSlot" | "reason",
    id: string,
  ) => (errors[field] ? `${id}-error` : undefined);
  const invalid = (field: "scores" | "winnerSlot" | "reason") =>
    errors[field] ? true : undefined;

  return (
    <section aria-labelledby={ids.heading} className="oc-card">
      <h2 id={ids.heading} ref={headingRef} tabIndex={-1} className="title">
        {correcting ? "Corriger" : "Résultat de"} {match.label} : {teams[0]}{" "}
        contre {teams[1]}
      </h2>

      <form
        id={form.id}
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="oc-field__label">Score</legend>
          <div className="flex flex-wrap gap-4">
            {match.slots.map((slot, i) => (
              <div key={slot.position} className="flex flex-col gap-1">
                <label htmlFor={`${ids.scores}-${i}`}>
                  {scoreLabel(teams[i])}
                </label>
                <input
                  id={`${ids.scores}-${i}`}
                  name={`score${i + 1}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  required
                  defaultValue={correcting ? (slot.score ?? "") : ""}
                  aria-invalid={invalid("scores")}
                  aria-describedby={describedBy("scores", ids.scores)}
                  className={`${controlClass} w-28 tabular-nums`}
                />
              </div>
            ))}
          </div>
          {errors.scores && (
            <FieldError id={`${ids.scores}-error`}>{errors.scores}</FieldError>
          )}
        </fieldset>

        <div
          role="radiogroup"
          aria-labelledby={`${ids.winner}-label`}
          aria-invalid={invalid("winnerSlot")}
          aria-describedby={describedBy("winnerSlot", ids.winner)}
          className="flex flex-col gap-1"
        >
          <p id={`${ids.winner}-label`} className="oc-field__label">
            Vainqueur
          </p>
          {match.slots.map((slot, i) => (
            <label
              key={slot.position}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                type="radio"
                name="winnerSlot"
                value={slot.position}
                required
                defaultChecked={correcting && slot.winner}
              />
              {teams[i]}
            </label>
          ))}
          {errors.winnerSlot && (
            <FieldError id={`${ids.winner}-error`}>
              {errors.winnerSlot}
            </FieldError>
          )}
        </div>

        {correcting && (
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.reason} className="oc-field__label">
              {labels.reason}
            </label>
            <p id={`${ids.reason}-hint`} className="oc-field__hint">
              Gardée dans l&apos;historique du match, par exemple « scores
              inversés ».
            </p>
            <textarea
              id={ids.reason}
              name="reason"
              rows={2}
              required
              aria-invalid={invalid("reason")}
              aria-describedby={[
                `${ids.reason}-hint`,
                describedBy("reason", ids.reason),
              ]
                .filter(Boolean)
                .join(" ")}
              className={`${controlClass} py-2`}
            />
            {errors.reason && (
              <FieldError id={`${ids.reason}-error`}>
                {errors.reason}
              </FieldError>
            )}
          </div>
        )}

        {form.formError && (
          <ErrorMessage announce={false}>{form.formError}</ErrorMessage>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={form.pending}
          >
            {form.pending
              ? "Enregistrement…"
              : correcting
                ? "Enregistrer la correction"
                : "Enregistrer le résultat"}
          </button>
          <button type="button" className={buttonClass} onClick={onCancel}>
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}
