import type { BracketMatch, BracketSlot } from "@/lib/api/models";
import { buttonClass } from "@/components/styles";
import { isPlayable } from "./bracket-text";

// A team in a match, with its outcome written out: the symbol helps at a
// glance, the word is what screen readers and color-blind users get
export function TeamLabel({
  slot,
  decided,
}: {
  slot: BracketSlot;
  decided: boolean;
}) {
  if (slot.state === "bye") return <span>Sans adversaire</span>;
  if (!slot.team) return <span className="italic">À déterminer</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={slot.winner ? "font-bold" : undefined}>
        {slot.team.name}
      </span>
      {decided && slot.winner && (
        <span className="rounded-full border-2 px-2 text-sm font-bold">
          <span aria-hidden="true">✓ </span>Vainqueur
        </span>
      )}
      {decided && !slot.winner && (
        <span className="rounded-full border-2 border-dashed px-2 text-sm">
          <span aria-hidden="true">✕ </span>Éliminé
        </span>
      )}
    </span>
  );
}

// "3 – 1", or nothing before the match is played
export const scoreText = (match: BracketMatch) =>
  match.hasResult ? match.slots.map((slot) => slot.score ?? 0).join(" – ") : "";

// Opens the result form of a match; absent when there is nothing to enter
export function MatchAction({
  match,
  onOpen,
  disabled,
}: {
  match: BracketMatch;
  onOpen: (match: BracketMatch, button: HTMLButtonElement) => void;
  disabled?: boolean;
}) {
  if (!isPlayable(match)) return null;
  const label = match.hasResult ? "Corriger" : "Saisir le résultat";
  return (
    <button
      type="button"
      className={buttonClass}
      disabled={disabled}
      aria-label={`${label} de ${match.label}`}
      data-match={match.id}
      onClick={(event) => onOpen(match, event.currentTarget)}
    >
      {label}
    </button>
  );
}
