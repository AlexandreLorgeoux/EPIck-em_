import type { IconName } from "@/components/brand/icon";
import type { BracketMatch, Prediction } from "@/lib/api/models";

export type PredictionState =
  "open" | "soon" | "locked" | "correct" | "wrong" | "cancelled";

// Each state is an icon and a word, never a color alone
export const predictionStates: Record<
  PredictionState,
  { label: string; icon: IconName; badge: string }
> = {
  open: { label: "Ouvert", icon: "clock", badge: "oc-badge--soon" },
  soon: { label: "À venir", icon: "clock", badge: "oc-badge--soon" },
  locked: { label: "Verrouillé", icon: "lock", badge: "oc-badge--locked" },
  correct: { label: "Juste", icon: "check", badge: "oc-badge--win" },
  wrong: { label: "Faux", icon: "close", badge: "oc-badge--loss" },
  cancelled: { label: "Annulé", icon: "info", badge: "oc-badge--locked" },
};

/**
 * The state of a prediction, or of a match nobody predicted yet. A
 * cancelled prediction whose pick was changed since is open again: the API
 * only clears "cancelled" at the next recalculation.
 */
export function predictionState(
  prediction: Prediction | undefined,
  locked: boolean,
): PredictionState {
  if (prediction) {
    const { status, team } = prediction;
    if (status === "correct" || status === "wrong") return status;
    if (status === "cancelled" && !team) return "cancelled";
  }
  return locked ? "locked" : "open";
}

// The same from the match itself, which may not have its teams yet
export const matchPredictionState = (
  match: BracketMatch,
  prediction: Prediction | undefined,
): PredictionState =>
  !prediction && match.predictionLock === "teams-unknown"
    ? "soon"
    : predictionState(prediction, match.predictionLock !== null);

// Why a match takes no prediction, in words
export function lockText(match: BracketMatch): string {
  switch (match.predictionLock) {
    case "teams-unknown":
      return "Pronostics ouverts quand les deux équipes seront connues.";
    case "started":
      return "Le match a commencé : pronostics verrouillés.";
    case "played":
      return "Le match est joué : pronostics verrouillés.";
    default:
      return "";
  }
}

// "Alpha (3 – 1)": the score is in slot order, like the results
export function pickText({ team, score }: Prediction): string {
  if (!team) return "L'équipe choisie ne joue plus ce match";
  return score ? `${team.name} (${score.join(" – ")})` : team.name;
}

export const pointsText = (points: number) =>
  `${points} point${points > 1 ? "s" : ""}`;

export const totalPoints = (predictions: Prediction[]) =>
  predictions.reduce((sum, { points }) => sum + points, 0);
