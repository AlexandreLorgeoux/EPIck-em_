"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorMessage } from "@/components/messages";
import { LiveStatus } from "@/components/live/live-status";
import { buttonClass } from "@/components/styles";
import { apiErrorMessage } from "@/components/toast/api-error-message";
import { api } from "@/lib/api/client";
import type { Leaderboard, LeaderboardEntry } from "@/lib/api/models";
import { useAuth } from "@/lib/auth/auth-provider";
import { loginPath } from "@/lib/auth/return-path";
import { useAnnouncer } from "@/lib/live/use-announcer";
import { useTournamentStream } from "@/lib/live/use-tournament-stream";
import { routes } from "@/lib/routes";
import { announceLeaderboard } from "./leaderboard-text";

const PAGE_SIZE = 20;

// The ranking of a tournament, kept up to date by its live events
export function LeaderboardBoard({
  tournamentId,
  slug,
}: {
  tournamentId: string;
  slug: string;
}) {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [page, setPage] = useState(1);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState("");
  const { message, announce } = useAnnouncer();
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The last call wins: an older answer never replaces a newer one
  const running = useRef<AbortController>(undefined);
  // What was last read, and what listeners were last told about
  const latest = useRef<Leaderboard | null>(null);
  const said = useRef<Leaderboard | null>(null);

  // live: a change pushed by the server, announced; otherwise the user
  // opened a page of the ranking
  const read = useCallback(
    async (live: boolean) => {
      running.current?.abort();
      const controller = new AbortController();
      running.current = controller;
      try {
        const next = await api.get<Leaderboard>(
          `/tournaments/${tournamentId}/leaderboard`,
          {
            query: { page, pageSize: PAGE_SIZE },
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        setBoard(next);
        setError("");
        latest.current = next;
        if (!live || !said.current) said.current = next;
        else
          announce(() => {
            const text = announceLeaderboard(said.current!, latest.current!);
            said.current = latest.current;
            return text;
          });
      } catch (caught) {
        if (controller.signal.aborted) return;
        // A failed live update keeps the ranking on screen until the next
        if (!live || !latest.current)
          setError(
            apiErrorMessage(
              caught,
              "Impossible de charger le classement. Réessaie dans un instant.",
            ),
          );
        throw caught;
      }
    },
    [tournamentId, page, announce],
  );

  useEffect(() => {
    if (loading) return;
    // Shown on screen, or tried again by the user or the stream
    // eslint-disable-next-line react-hooks/set-state-in-effect -- set after the calls
    read(false).catch(() => {});
    return () => running.current?.abort();
    // userId: signing in or out changes `me`
  }, [read, loading, userId]);

  const status = useTournamentStream(
    tournamentId,
    useCallback(() => read(true), [read]),
  );

  const pages = board ? Math.max(1, Math.ceil(board.total / PAGE_SIZE)) : 1;
  const me = board?.me;
  const meOnPage = board?.entries.some((e) => e.user.id === me?.user.id);

  return (
    <section aria-labelledby="ranking" className="flex flex-col gap-4">
      <h2 id="ranking" ref={headingRef} tabIndex={-1} className="title">
        Classement
      </h2>
      <LiveStatus status={status} announcement={message} />

      {!loading && !user && (
        <p>
          <Link
            href={loginPath(routes.leaderboard(slug))}
            className="underline underline-offset-4"
          >
            Connecte-toi
          </Link>{" "}
          pour voir ta place.
        </p>
      )}

      {error && (
        <>
          <ErrorMessage>{error}</ErrorMessage>
          <button
            type="button"
            className={`${buttonClass} self-start`}
            onClick={() => {
              // This button goes away: focus what stays
              headingRef.current?.focus();
              setError("");
              read(false).catch(() => {});
            }}
          >
            Réessayer
          </button>
        </>
      )}
      {!error && !board && <p role="status">Chargement du classement…</p>}
      {board?.total === 0 && (
        <p>Personne n&apos;a encore fait de pronostic sur ce tournoi.</p>
      )}

      {board && board.total > 0 && (
        <>
          <table className="oc-table max-sm:[&_td]:px-1 max-sm:[&_th]:px-1">
            <caption>
              {board.total} participant{board.total > 1 ? "s" : ""}, du plus au
              moins de points
            </caption>
            <thead>
              <tr>
                <th scope="col">Rang</th>
                <th scope="col">Participant</th>
                <th scope="col">Points</th>
                <th scope="col">Bons pronostics</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((entry) => (
                <Row
                  key={entry.user.id}
                  entry={entry}
                  mine={entry.user.id === me?.user.id}
                />
              ))}
            </tbody>
            {me && !meOnPage && (
              <tfoot>
                <Row entry={me} mine />
              </tfoot>
            )}
          </table>

          {pages > 1 && (
            <nav
              aria-label="Pages du classement"
              className="flex flex-wrap items-center gap-3"
            >
              <PageButton
                label="Page précédente"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              />
              <p role="status">
                Page {board.page} sur {pages}
              </p>
              <PageButton
                label="Page suivante"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              />
            </nav>
          )}
        </>
      )}
    </section>
  );
}

// My row: a word, a thick border and a background, never the color alone
function Row({ entry, mine }: { entry: LeaderboardEntry; mine: boolean }) {
  return (
    <tr
      aria-current={mine ? "true" : undefined}
      className={mine ? "bg-surface-strong font-bold" : undefined}
    >
      <td className={`tabular ${mine ? "border-l-4 border-l-brand" : ""}`}>
        {entry.rank}
      </td>
      <th scope="row" className="break-words text-ink [overflow-wrap:anywhere]">
        {entry.user.displayName}
        {mine && " (toi)"}
      </th>
      <td className="tabular">{entry.points}</td>
      <td className="tabular">
        {entry.correctPicks} sur {entry.predictions}
      </td>
    </tr>
  );
}

// aria-disabled, not disabled: focus stays on the button at the last page
function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={buttonClass}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      {label}
    </button>
  );
}
