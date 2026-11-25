"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/styles";
import type { BracketMatch, Prediction } from "@/lib/api/models";
import { PredictionBadge } from "./prediction-badge";
import { PredictionForm } from "./prediction-form";
import {
  lockText,
  matchPredictionState,
  pickText,
  pointsText,
} from "./prediction-text";

/**
 * The user's prediction on a match: its state, their pick and, while the
 * match is open, a button that turns into the form. Focus goes into the
 * form, then back to the button, or to the text when the match locked.
 */
export function MatchPrediction({
  match,
  prediction,
  onSaved,
  onRefused,
}: {
  match: BracketMatch;
  prediction?: Prediction;
  onSaved: (prediction: Prediction) => void;
  onRefused: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  // Set when the form closes: the button is back only after the next render
  const returnFocus = useRef(false);

  useEffect(() => {
    if (editing || !returnFocus.current) return;
    returnFocus.current = false;
    (buttonRef.current ?? textRef.current)?.focus();
  }, [editing]);

  function close() {
    returnFocus.current = true;
    setEditing(false);
  }

  if (match.predictionLock === "bye") return null;

  const open = match.predictionLock === null;
  if (editing && open) {
    return (
      <PredictionForm
        match={match}
        prediction={prediction}
        onSaved={(saved) => {
          onSaved(saved);
          close();
        }}
        onRefused={() => {
          // Closed once the new state is known, so the button does not
          // come back for a match that just locked
          void onRefused().finally(close);
        }}
        onCancel={close}
      />
    );
  }

  const state = matchPredictionState(match, prediction);
  const label = prediction ? "Modifier mon pronostic" : "Pronostiquer";
  return (
    <div
      ref={textRef}
      tabIndex={-1}
      className="flex flex-col items-start gap-2"
    >
      <PredictionBadge state={state} />
      {prediction ? (
        <p className="body-sm">
          Mon pronostic : <strong>{pickText(prediction)}</strong>
          {(state === "correct" || state === "wrong") &&
            `, ${pointsText(prediction.points)}`}
        </p>
      ) : (
        !open && <p className="body-sm text-ink-soft">{lockText(match)}</p>
      )}
      {open && (
        <button
          ref={buttonRef}
          type="button"
          className={buttonClass}
          aria-label={`${label}, ${match.label}`}
          onClick={() => setEditing(true)}
        >
          {prediction ? "Modifier" : "Pronostiquer"}
        </button>
      )}
    </div>
  );
}
