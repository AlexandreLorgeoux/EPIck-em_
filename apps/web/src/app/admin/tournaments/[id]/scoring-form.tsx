"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormField, controlClass } from "@/components/form-field";
import { ErrorMessage } from "@/components/messages";
import { buttonClass } from "@/components/styles";
import { apiErrorMessage } from "@/components/toast/api-error-message";
import { api } from "@/lib/api/client";
import type { Scoring } from "@/lib/api/models";
import { useApiForm } from "@/lib/forms/use-api-form";

const fields = {
  pointsCorrectPick: {
    label: "Points pour le bon vainqueur",
    hint: "Au premier tour, de 0 à 100",
  },
  roundIncrement: {
    label: "Points en plus à chaque tour",
    hint: "De 0 à 100 ; 0 si tous les tours valent pareil",
  },
  exactScoreBonus: {
    label: "Bonus pour le score exact",
    hint: "De 0 à 100, ajouté au bon vainqueur",
  },
} as const;

type Field = keyof typeof fields;
const names = Object.keys(fields) as Field[];
const labels = Object.fromEntries(
  names.map((name) => [name, fields[name].label]),
);

// An empty field is sent as null, so the API says it is missing
const toPoints = (value: string) => (value === "" ? null : Number(value));

// "Tour 1 : 3 points, tour 2 : 4 points, tour 3 : 5 points. Score exact : +2."
function example(values: Record<Field, string>): string {
  const [base, increment, bonus] = names.map((name) => Number(values[name]));
  if (
    names.some((name) => values[name] === "") ||
    [base, increment, bonus].some((n) => !Number.isInteger(n) || n < 0)
  )
    return "";
  const rounds = [1, 2, 3].map((round) => {
    const points = base + (round - 1) * increment;
    return `tour ${round} : ${points} point${points > 1 ? "s" : ""}`;
  });
  return `Exemple : ${rounds.join(", ")}. Score exact : +${bonus}.`;
}

/**
 * The points of a tournament's predictions. Changing them once results are
 * in scores every prediction again.
 */
export function ScoringForm({ tournamentId }: { tournamentId: string }) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [scoring, setScoring] = useState<Scoring | null>(null);
  const [values, setValues] = useState<Record<Field, string> | null>(null);
  const [loadError, setLoadError] = useState("");
  const form = useApiForm(labels);

  const show = useCallback((next: Scoring) => {
    setScoring(next);
    setValues({
      pointsCorrectPick: String(next.pointsCorrectPick),
      roundIncrement: String(next.roundIncrement),
      exactScoreBonus: String(next.exactScoreBonus),
    });
  }, []);

  const load = useCallback(
    () =>
      api
        .get<Scoring>(`/tournaments/${tournamentId}/scoring`)
        .then((next) => {
          show(next);
          setLoadError("");
        })
        .catch((caught: unknown) =>
          setLoadError(
            apiErrorMessage(
              caught,
              "Impossible de charger le barème. Réessaie dans un instant.",
            ),
          ),
        ),
    [tournamentId, show],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const submit = form.onSubmit(async (typed) => {
    show(
      await api.put<Scoring>(`/tournaments/${tournamentId}/scoring`, {
        pointsCorrectPick: toPoints(typed.pointsCorrectPick),
        exactScoreBonus: toPoints(typed.exactScoreBonus),
        roundIncrement: toPoints(typed.roundIncrement),
      }),
    );
    return "Barème enregistré : les pronostics déjà joués sont recalculés.";
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="title">
        Barème des pronostics
      </h2>

      {loadError && (
        <>
          <ErrorMessage>{loadError}</ErrorMessage>
          <button
            type="button"
            className={`${buttonClass} self-start`}
            onClick={() => {
              // This button goes away: focus what stays
              headingRef.current?.focus();
              setLoadError("");
              void load();
            }}
          >
            Réessayer
          </button>
        </>
      )}
      {!loadError && !values && <p>Chargement du barème…</p>}

      {values && scoring && (
        <form
          id={form.id}
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4"
        >
          <p>
            {scoring.isDefault
              ? "Barème par défaut. "
              : "Barème choisi pour ce tournoi. "}
            Un changement s&apos;applique à tous les pronostics, même sur les
            matchs déjà joués : le classement peut changer.
          </p>
          {names.map((name) => (
            <FormField
              key={name}
              label={fields[name].label}
              hint={fields[name].hint}
              error={form.fieldErrors[name]}
            >
              {(props) => (
                <input
                  {...props}
                  name={name}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  required
                  value={values[name]}
                  onChange={(event) =>
                    setValues({ ...values, [name]: event.target.value })
                  }
                  className={`${controlClass} w-28 tabular-nums`}
                />
              )}
            </FormField>
          ))}
          {example(values) && <p>{example(values)}</p>}

          {form.formError && (
            <ErrorMessage announce={false}>{form.formError}</ErrorMessage>
          )}
          <button
            type="submit"
            disabled={form.pending}
            className={`${buttonClass} self-start`}
          >
            {form.pending ? "Enregistrement…" : "Enregistrer le barème"}
          </button>
        </form>
      )}
    </section>
  );
}
