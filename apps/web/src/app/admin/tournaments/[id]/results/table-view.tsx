import type { Bracket, BracketMatch } from "@/lib/api/models";
import { matchStatus, roundName } from "./bracket-text";
import { MatchAction, TeamLabel, scoreText } from "./match-parts";

// The same matches as the bracket, one row each: easier to read with a
// screen reader or on a small screen
export function TableView({
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
      aria-label="Tableau des matchs"
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Tous les matchs, tour par tour, avec leur score et leur état
        </caption>
        <thead>
          <tr className="border-b-2">
            {["Tour", "Match", "Équipe 1", "Score", "Équipe 2", "État"].map(
              (title) => (
                <th key={title} scope="col" className="py-2 pr-4">
                  {title}
                </th>
              ),
            )}
            <th scope="col" className="py-2">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bracket.rounds.flatMap(({ round, matches }) =>
            matches.map((match) => {
              const decided = match.state === "decided";
              const [first, second] = match.slots;
              return (
                <tr key={match.id} className="border-b align-top">
                  <td className="py-3 pr-4">{roundName(round, rounds)}</td>
                  <th scope="row" className="py-3 pr-4">
                    {match.label}
                  </th>
                  <td className="py-3 pr-4">
                    <TeamLabel slot={first} decided={decided} />
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {scoreText(match) || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <TeamLabel slot={second} decided={decided} />
                  </td>
                  <td className="py-3 pr-4">{matchStatus(match)}</td>
                  <td className="py-3">
                    <MatchAction
                      match={match}
                      onOpen={onOpen}
                      disabled={busy}
                    />
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
