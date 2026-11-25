import { isApiError } from "@/lib/api/errors";
import { explainMessage } from "@/lib/forms/explain";

// Why a prediction was refused, by the reason the API gives (ticket #49)
const lockedPrediction: Record<string, string> = {
  started:
    "Pronostic refusé : le match a commencé, les pronostics sont verrouillés.",
  played: "Pronostic refusé : le match est déjà joué.",
  "teams-unknown":
    "Pronostic impossible pour l'instant : les deux équipes ne sont pas encore connues.",
  bye: "Pas de pronostic pour ce match : une équipe n'a pas d'adversaire.",
};

/**
 * A message for an error toast, in French, from what the server said.
 * Sign-in and permission errors get their own wording, and anything the
 * server did not explain falls back to `fallback`.
 */
export function apiErrorMessage(
  caught: unknown,
  fallback = "L'action a échoué. Réessaie dans un instant.",
): string {
  if (!isApiError(caught)) return fallback;
  if (caught.code === "prediction_locked") {
    return lockedPrediction[caught.reason ?? ""] ?? lockedPrediction.started;
  }
  if (caught.status === 401) {
    return "Ta session a expiré : reconnecte-toi pour continuer.";
  }
  if (caught.status === 403) {
    return "Tu n'as pas les droits pour faire cette action.";
  }
  if (Object.keys(caught.fieldErrors).length) {
    const count = Object.keys(caught.fieldErrors).length;
    return count > 1
      ? `${count} champs sont à corriger : regarde les messages sous chacun.`
      : "Un champ est à corriger : regarde le message sous ce champ.";
  }
  if (caught.status >= 500) {
    return "Le serveur a rencontré un problème. Réessaie dans un instant.";
  }
  return caught.messages.length ? explainMessage(caught.message) : fallback;
}
