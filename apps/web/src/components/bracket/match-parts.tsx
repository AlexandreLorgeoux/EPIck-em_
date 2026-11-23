import type { BracketMatch, BracketSlot } from "@/lib/api/models";
import { Icon } from "@/components/brand/icon";
import { buttonClass } from "@/components/styles";
import { isPlayable } from "./bracket-text";

// A team in a match, with its outcome as an Oracup badge: the icon helps at
// a glance, the word is what screen readers and color-blind users get
export function TeamLabel({
  slot,
  decided,
}: {
  slot: BracketSlot;
  decided: boolean;
}) {
  if (slot.state === "bye")
    return <span className="text-ink-soft">Exempt</span>;
  if (!slot.team) return <span className="text-ink-soft">À déterminer</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={slot.winner ? "font-bold" : undefined}>
        {slot.team.name}
      </span>
      {/* Read as two words: "Alpha Vainqueur" */}
      {decided && " "}
      {decided && slot.winner && (
        <span className="oc-badge oc-badge--win">
          <Icon name="check" />
          Vainqueur
        </span>
      )}
      {decided && !slot.winner && (
        <span className="oc-badge oc-badge--loss">
          <Icon name="close" />
          Éliminé
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
