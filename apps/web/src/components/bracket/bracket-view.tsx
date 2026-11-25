import type { ReactNode } from "react";
import type { Bracket, BracketMatch } from "@/lib/api/models";
import {
  feederMatch,
  matchStatus,
  needsAttention,
  nextText,
  roundName,
} from "./bracket-text";
import { MatchAction, TeamLabel, scoreText } from "./match-parts";

// The bracket drawn as columns of rounds. Wide brackets scroll
// sideways inside their own region, reachable with the keyboard.
export function BracketView({
  bracket,
  onOpen,
  busy,
  renderPrediction,
}: {
  bracket: Bracket;
  // Opens the result form of a match; left out, the view is read-only
  onOpen?: (match: BracketMatch, button: HTMLButtonElement) => void;
  busy?: boolean;
  renderPrediction?: (match: BracketMatch) => ReactNode;
}) {
  const rounds = bracket.rounds.length;
  return (
    <div
      role="region"
      aria-label="Arbre du tournoi"
      tabIndex={0}
      // relative: keeps hidden labels inside the scrolled area
      className="relative overflow-x-auto pb-4"
    >
      <ol className="flex min-w-max gap-6">
        {bracket.rounds.map(({ round, matches }) => (
          <li key={round} className="flex w-72 flex-col gap-4">
            <h2 className="title">{roundName(round, rounds)}</h2>
            <ul className="flex grow flex-col justify-around gap-4">
              {matches.map((match) => {
                // Badges for played matches only: a bye is decided without a winner
                // in the sporting sense
                const decided = match.state === "decided" && match.hasResult;
                return (
                  <li
                    key={match.id}
                    // A match to correct gets a dashed loss border; its
                    // status says why in words
                    className={`oc-card ${
                      needsAttention(match)
                        ? "border-2 border-dashed border-loss"
                        : ""
                    }`}
                  >
                    <h3 className="heading">{match.label}</h3>
                    <ul className="flex flex-col gap-1">
                      {match.slots.map((slot) => (
                        <li
                          key={slot.position}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <TeamLabel
                            slot={slot}
                            decided={decided}
                            feeder={
                              feederMatch(
                                bracket,
                                round,
                                match.position,
                                slot.position,
                              )?.label
                            }
                          />
                          {match.hasResult && (
                            <span className="tabular text-xl font-bold">
                              {slot.score ?? 0}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="body-sm text-ink-soft">
                      {matchStatus(match)}
                      {match.hasResult && (
                        <span className="sr-only">
                          , score {scoreText(match)}
                        </span>
                      )}
                    </p>
                    <p className="body-sm text-ink-soft">
                      {nextText(bracket, round, match.position)}
                    </p>
                    {renderPrediction?.(match)}
                    {onOpen && (
                      <MatchAction
                        match={match}
                        onOpen={onOpen}
                        disabled={busy}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
