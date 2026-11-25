"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/dialog";
import { ErrorMessage } from "@/components/messages";
import { buttonClass } from "@/components/styles";
import { apiErrorMessage } from "@/components/toast/api-error-message";
import { api } from "@/lib/api/client";
import type { Prediction } from "@/lib/api/models";
import { PredictionBadge } from "./prediction-badge";
import {
  pickText,
  pointsText,
  predictionState,
  totalPoints,
} from "./prediction-text";

type Loaded =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; predictions: Prediction[] };

const loadMine = () =>
  api
    .get<Prediction[]>("/me/predictions")
    .then((predictions): Loaded => ({ kind: "ready", predictions }))
    .catch((caught: unknown): Loaded => ({
      kind: "error",
      message: apiErrorMessage(
        caught,
        "Impossible de charger tes pronostics. Réessaie dans un instant.",
      ),
    }));

// Predictions of each tournament, in the order the API gives them
function byTournament(predictions: Prediction[]) {
  const groups = new Map<string, Prediction[]>();
  for (const prediction of predictions) {
    const { id } = prediction.tournament;
    groups.set(id, [...(groups.get(id) ?? []), prediction]);
  }
  return [...groups.values()];
}

// The window with all the user's predictions, read again at each opening
export function MyPredictions({
  updates,
  onClose,
}: {
  // Grows with each live change: the list is read again
  updates: number;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    let current = true;
    loadMine().then((next) => {
      if (!current) return;
      // A failed update keeps the list on screen
      setLoaded((before) =>
        next.kind === "error" && before.kind === "ready" ? before : next,
      );
    });
    return () => {
      current = false;
      active.current = false;
    };
  }, [updates]);

  function retry(button: HTMLButtonElement) {
    // The button goes away: keep focus in the window
    button.closest("dialog")?.querySelector("h2")?.focus();
    setLoaded({ kind: "loading" });
    loadMine().then((next) => active.current && setLoaded(next));
  }

  return (
    <Dialog title="Mes pronostics" onClose={onClose}>
      <p role="status" className={loaded.kind === "ready" ? "sr-only" : ""}>
        {loaded.kind === "loading" && "Chargement de tes pronostics…"}
        {loaded.kind === "ready" &&
          `${loaded.predictions.length} pronostic${loaded.predictions.length > 1 ? "s" : ""}`}
      </p>
      {loaded.kind === "error" && (
        <>
          <ErrorMessage>{loaded.message}</ErrorMessage>
          <button
            type="button"
            className={`${buttonClass} self-start`}
            onClick={(event) => retry(event.currentTarget)}
          >
            Réessayer
          </button>
        </>
      )}
      {loaded.kind === "ready" && !loaded.predictions.length && (
        <p>
          Tu n&apos;as pas encore de pronostic. Choisis un match ouvert et
          appuie sur « Pronostiquer ».
        </p>
      )}
      {loaded.kind === "ready" && loaded.predictions.length > 0 && (
        <>
          <p className="heading">
            Total : {pointsText(totalPoints(loaded.predictions))}
          </p>
          {byTournament(loaded.predictions).map((predictions) => (
            <TournamentPredictions
              key={predictions[0].tournament.id}
              predictions={predictions}
            />
          ))}
        </>
      )}
    </Dialog>
  );
}

function TournamentPredictions({ predictions }: { predictions: Prediction[] }) {
  const { name } = predictions[0].tournament;
  return (
    <div
      role="region"
      aria-label={`Pronostics, ${name}`}
      tabIndex={0}
      // relative: keeps hidden labels inside the scrolled area
      className="relative overflow-x-auto"
    >
      <table className="oc-table max-sm:[&_td]:px-1 max-sm:[&_th]:px-1">
        <caption>{name}</caption>
        <thead>
          <tr>
            {["Match", "Pronostic", "Statut", "Points"].map((title) => (
              <th key={title} scope="col">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {predictions.map((prediction) => (
            <tr key={prediction.id} className="align-top">
              <th scope="row" className="text-ink">
                {prediction.match.label}
                <span className="block font-normal">
                  {prediction.match.teams
                    .map((team) => team?.name ?? "À déterminer")
                    .join(" contre ")}
                </span>
              </th>
              <td>{pickText(prediction)}</td>
              <td>
                <PredictionBadge
                  state={predictionState(prediction, prediction.locked)}
                />
              </td>
              <td className="tabular">{prediction.points}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              Total du tournoi
            </th>
            <td className="tabular font-bold">{totalPoints(predictions)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
