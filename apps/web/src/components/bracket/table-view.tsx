import { useId, type ReactNode } from "react";
import type { Bracket, BracketMatch } from "@/lib/api/models";
import {
  feederMatch,
  matchStatus,
  needsAttention,
  nextText,
  roundName,
} from "./bracket-text";
import { MatchAction, TeamLabel, scoreText } from "./match-parts";

/**
 * The same information as the bracket, one table per round: easier to read
 * with a screen reader or on a small screen, where each row becomes a block
 * (oc-matches). The roles are written out because changing the display of
 * a table makes some browsers drop them.
 */
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
  const id = useId();
  const columns = [
    "Match",
    "Équipe 1",
    "Score",
    "Équipe 2",
    "État",
    "Suite",
    ...(renderPrediction ? ["Mon pronostic"] : []),
    ...(onOpen ? ["Action"] : []),
  ];
  return (
    <div className="flex flex-col gap-8">
      {bracket.rounds.map(({ round, matches }) => (
        <section
          key={round}
          aria-labelledby={`${id}-${round}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`${id}-${round}`} className="title">
            {roundName(round, bracket.rounds.length)}
          </h2>
          <table
            role="table"
            aria-labelledby={`${id}-${round}`}
            className="oc-table oc-matches"
          >
            <thead role="rowgroup">
              <tr role="row">
                {columns.map((title) => (
                  <th key={title} scope="col" role="columnheader">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {matches.map((match) => {
                // Badges for played matches only: a bye is decided without a
                // winner in the sporting sense
                const decided = match.state === "decided" && match.hasResult;
                const team = (slot: 1 | 2) => (
                  <TeamLabel
                    slot={match.slots[slot - 1]}
                    decided={decided}
                    feeder={
                      feederMatch(bracket, round, match.position, slot)?.label
                    }
                  />
                );
                return (
                  <tr key={match.id} role="row" className="align-top">
                    <th scope="row" role="rowheader" className="text-ink">
                      {match.label}
                    </th>
                    <td role="cell" data-label="Équipe 1">
                      {team(1)}
                    </td>
                    <td role="cell" data-label="Score" className="tabular">
                      {scoreText(match) || "—"}
                    </td>
                    <td role="cell" data-label="Équipe 2">
                      {team(2)}
                    </td>
                    <td
                      role="cell"
                      data-label="État"
                      // Like the dashed border of the bracket; the words say why
                      className={
                        needsAttention(match)
                          ? "font-bold text-loss"
                          : undefined
                      }
                    >
                      {matchStatus(match)}
                    </td>
                    <td role="cell" data-label="Suite">
                      {nextText(bracket, round, match.position)}
                    </td>
                    {renderPrediction && (
                      <td role="cell" data-label="Mon pronostic">
                        {renderPrediction(match)}
                      </td>
                    )}
                    {onOpen && (
                      <td role="cell" data-label="Action">
                        <MatchAction
                          match={match}
                          onOpen={onOpen}
                          disabled={busy}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
