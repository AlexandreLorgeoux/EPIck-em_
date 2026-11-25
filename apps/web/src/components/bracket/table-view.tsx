import type { ReactNode } from "react";
import type { Bracket, BracketMatch } from "@/lib/api/models";
import { matchStatus, roundName } from "./bracket-text";
import { MatchAction, TeamLabel, scoreText } from "./match-parts";

// The same matches as the bracket, one row each: easier to read with a
// screen reader or on a small screen
export function TableView({
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
      aria-label="Tableau des matchs"
      tabIndex={0}
      // relative: keeps hidden labels inside the scrolled area
      className="relative overflow-x-auto"
    >
      <table className="oc-table">
        <caption className="sr-only">
          Tous les matchs, tour par tour, avec leur score et leur état
        </caption>
        <thead>
          <tr>
            {["Tour", "Match", "Équipe 1", "Score", "Équipe 2", "État"].map(
              (title) => (
                <th key={title} scope="col">
                  {title}
                </th>
              ),
            )}
            {renderPrediction && <th scope="col">Mon pronostic</th>}
            {onOpen && (
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {bracket.rounds.flatMap(({ round, matches }) =>
            matches.map((match) => {
              // Badges for played matches only: a bye is decided without a winner
              // in the sporting sense
              const decided = match.state === "decided" && match.hasResult;
              const [first, second] = match.slots;
              return (
                <tr key={match.id} className="align-top">
                  <td>{roundName(round, rounds)}</td>
                  <th scope="row" className="text-ink">
                    {match.label}
                  </th>
                  <td>
                    <TeamLabel slot={first} decided={decided} />
                  </td>
                  <td className="tabular">{scoreText(match) || "—"}</td>
                  <td>
                    <TeamLabel slot={second} decided={decided} />
                  </td>
                  <td>{matchStatus(match)}</td>
                  {renderPrediction && (
                    <td className="min-w-64">{renderPrediction(match)}</td>
                  )}
                  {onOpen && (
                    <td>
                      <MatchAction
                        match={match}
                        onOpen={onOpen}
                        disabled={busy}
                      />
                    </td>
                  )}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
