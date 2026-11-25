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

// The team that won the final, once it is played
export function championOf(bracket: Bracket): string | null {
  const final = bracket.rounds.at(-1)?.matches[0];
  if (final?.state !== "decided") return null;
  return final.slots.find((slot) => slot.winner)?.team?.name ?? null;
}

// Single elimination: matches 1 and 2 of a round feed match 1 of the next,
// matches 3 and 4 feed match 2, and so on

// Where the winner of a match goes; null for the final
export function nextMatch(
  bracket: Bracket,
  round: number,
  position: number,
): BracketMatch | null {
  const next = bracket.rounds.find((r) => r.round === round + 1);
  return (
    next?.matches.find((m) => m.position === Math.ceil(position / 2)) ?? null
  );
}

// The match whose winner takes a slot; null in the first round
export function feederMatch(
  bracket: Bracket,
  round: number,
  position: number,
  slot: number,
): BracketMatch | null {
  const previous = bracket.rounds.find((r) => r.round === round - 1);
  const feeder = 2 * (position - 1) + slot;
  return previous?.matches.find((m) => m.position === feeder) ?? null;
}

// The path of the bracket in words: "Le vainqueur joue Match 5"
export function nextText(bracket: Bracket, round: number, position: number) {
  const next = nextMatch(bracket, round, position);
  return next
    ? `Le vainqueur joue ${next.label}`
    : "Le vainqueur remporte le tournoi";
}
