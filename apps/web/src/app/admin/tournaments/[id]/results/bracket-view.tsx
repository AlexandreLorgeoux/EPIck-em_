import type { Bracket, BracketMatch } from "@/lib/api/models";
import { matchStatus, needsAttention, roundName } from "./bracket-text";
import { MatchAction, TeamLabel, scoreText } from "./match-parts";

// The bracket drawn as columns of rounds. Wide brackets scroll
// sideways inside their own region, reachable with the keyboard.
export function BracketView({
  bracket,
  onOpen,
  busy,
}: {
  bracket: Bracket;
  onOpen: (match: BracketMatch, button: HTMLButtonElement) => void;
  busy: boolean;
}) {
  const rounds = bracket.rounds.length;
  return (
    <div
      role="region"
      aria-label="Arbre du tournoi"
      tabIndex={0}
      className="overflow-x-auto pb-4"
    >
      <ol className="flex min-w-max gap-6">
        {bracket.rounds.map(({ round, matches }) => (
          <li key={round} className="flex w-72 flex-col gap-4">
            <h2 className="text-xl font-bold">{roundName(round, rounds)}</h2>
            <ul className="flex grow flex-col justify-around gap-4">
              {matches.map((match) => {
                const decided = match.state === "decided";
                return (
                  <li
                    key={match.id}
                    className={`flex flex-col gap-2 rounded-md border-2 p-3 ${
                      needsAttention(match) ? "border-dashed" : ""
                    }`}
                  >
                    <h3 className="font-bold">{match.label}</h3>
                    <ul className="flex flex-col gap-1">
                      {match.slots.map((slot) => (
                        <li
                          key={slot.position}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <TeamLabel slot={slot} decided={decided} />
                          {match.hasResult && (
                            <span className="tabular-nums font-bold">
                              {slot.score ?? 0}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm">
                      {matchStatus(match)}
                      {match.hasResult && (
                        <span className="sr-only">
                          , score {scoreText(match)}
                        </span>
                      )}
                    </p>
                    <MatchAction
                      match={match}
                      onOpen={onOpen}
                      disabled={busy}
                    />
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
