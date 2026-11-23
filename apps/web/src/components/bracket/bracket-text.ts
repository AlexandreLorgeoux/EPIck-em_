import type { Bracket, BracketMatch, MatchState } from "@/lib/api/models";

// Name of a round from its distance to the final: "Finale", "Demi-finales"
export function roundName(round: number, rounds: number) {
  const fromFinal = rounds - round;
  if (fromFinal === 0) return "Finale";
  if (fromFinal === 1) return "Demi-finales";
  if (fromFinal === 2) return "Quarts de finale";
  return `Tour ${round}`;
}

// Where a team goes next, as in "passe en demi-finale"
function nextStage(round: number, rounds: number) {
  const fromFinal = rounds - round;
  if (fromFinal === 0) return "en finale";
  if (fromFinal === 1) return "en demi-finale";
  if (fromFinal === 2) return "en quart de finale";
  return `au tour ${round}`;
}

const isBye = (match: BracketMatch) =>
  match.slots.some((slot) => slot.state === "bye");

// Whether a result can be entered or corrected now
export const isPlayable = (match: BracketMatch) =>
  !isBye(match) && match.slots.every((slot) => slot.state === "assigned");

// The state of a match in words, so it never relies on color
export function matchStatus(match: BracketMatch): string {
  if (isBye(match)) return "Sans adversaire";
  const states: Record<MatchState, string> = {
    pending: isPlayable(match) ? "À jouer" : "En attente des équipes",
    decided: "Terminé",
    stale: "À corriger : les équipes ont changé",
    conflict: "Résultat incohérent : à corriger",
    void: "Annulé",
  };
  return states[match.state];
}

export const needsAttention = (match: BracketMatch) =>
  match.state === "stale" || match.state === "conflict";

/**
 * One sentence for screen readers after a result is saved: where the
 * winner goes, and which later matches now need a correction. One message
 * per save, never one per changed match, so the user is not flooded.
 */
export function announceResult(bracket: Bracket, matchId: string): string {
  const rounds = bracket.rounds.length;
  const located = bracket.rounds
    .flatMap((r) => r.matches.map((match) => ({ round: r.round, match })))
    .find(({ match }) => match.id === matchId);
  if (!located) return "Résultat enregistré.";
  const { round, match } = located;
  const winner = match.slots.find((slot) => slot.winner)?.team?.name;

  let sentence: string;
  if (!winner) {
    sentence = `Résultat de ${match.label} enregistré.`;
  } else if (round === rounds) {
    sentence = `${winner} gagne la finale et remporte le tournoi.`;
  } else {
    sentence = `${winner} gagne ${match.label} et passe ${nextStage(round + 1, rounds)}.`;
  }

  const toFix = bracket.rounds
    .flatMap((r) => r.matches)
    .filter(needsAttention)
    .map((m) => m.label);
  if (toFix.length === 1) {
    sentence += ` ${toFix[0]} est à corriger : ses équipes ont changé.`;
  } else if (toFix.length > 1) {
    sentence += ` ${toFix.length} matchs sont à corriger : ${toFix.join(", ")}.`;
  }
  return sentence;
}
