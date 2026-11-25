"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/brand/icon";
import { announceChanges, championOf } from "@/components/bracket/bracket-text";
import { BracketSwitcher } from "@/components/bracket/bracket-switcher";
import { LiveStatus } from "@/components/live/live-status";
import { ErrorMessage } from "@/components/messages";
import { buttonClass } from "@/components/styles";
import { apiErrorMessage } from "@/components/toast/api-error-message";
import { api } from "@/lib/api/client";
import type { Bracket, Prediction, Tournament } from "@/lib/api/models";
import { useAuth } from "@/lib/auth/auth-provider";
import { loginPath } from "@/lib/auth/return-path";
import { useAnnouncer } from "@/lib/live/use-announcer";
import { useTournamentStream } from "@/lib/live/use-tournament-stream";
import { routes } from "@/lib/routes";
import { MatchPrediction } from "./match-prediction";
import { MyPredictions } from "./my-predictions";

// A signed-in user's predictions by match
interface Mine {
  userId: string;
  predictions: Map<string, Prediction>;
}

/**
 * The public bracket, kept up to date by the live events, and, for a
 * signed-in user, their prediction on each match. Visitors and users whose
 * predictions did not load still get the bracket.
 */
export function PredictionBoard({
  tournament,
  bracket: initial,
}: {
  tournament: Pick<Tournament, "id" | "slug">;
  // From the page, which is cached: read again as soon as possible
  bracket: Bracket;
}) {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const { id, slug } = tournament;
  const [fresh, setFresh] = useState<Bracket | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  const [showMine, setShowMine] = useState(false);
  const [updates, setUpdates] = useState(0);
  const { message, announce } = useAnnouncer();
  const mineButton = useRef<HTMLButtonElement>(null);
  // The last call wins: an older answer never replaces a newer one
  const running = useRef<AbortController>(undefined);
  // What was last read, and what listeners were last told about
  const latest = useRef<Bracket | null>(null);
  const said = useRef<Bracket | null>(null);
  const loadedFor = useRef<string>(undefined);

  // Rejects when it fails, after showing the error unless there already
  // are predictions on screen
  const read = useCallback(async () => {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    try {
      const [bracket, predictions] = await Promise.all([
        api.get<Bracket>(`/tournaments/${id}/bracket`, { signal }),
        userId
          ? api.get<Prediction[]>("/me/predictions", {
              query: { tournament: id },
              signal,
            })
          : null,
      ]);
      if (signal.aborted) return;
      setFresh(bracket);
      latest.current = bracket;
      // Nothing to say about the first read: it only replaces a cached copy
      said.current ??= bracket;
      if (userId && predictions) {
        setMine({
          userId,
          predictions: new Map(predictions.map((p) => [p.match.id, p])),
        });
        loadedFor.current = userId;
      }
      setError("");
    } catch (caught) {
      if (signal.aborted) return;
      if (userId && loadedFor.current !== userId)
        setError(
          apiErrorMessage(
            caught,
            "Impossible de charger tes pronostics. Réessaie dans un instant.",
          ),
        );
      throw caught;
    } finally {
      if (running.current === controller) running.current = undefined;
    }
  }, [id, userId]);

  useEffect(() => {
    if (!userId) return;
    // The error is on screen, with a button to retry
    // eslint-disable-next-line react-hooks/set-state-in-effect -- set after the calls
    read().catch(() => {});
    return () => running.current?.abort();
  }, [read, userId]);

  const status = useTournamentStream(
    id,
    useCallback(async () => {
      await read();
      setUpdates((count) => count + 1);
      announce(() => {
        if (!said.current || !latest.current) return "";
        const text = announceChanges(said.current, latest.current);
        said.current = latest.current;
        return text;
      });
    }, [read, announce]),
  );

  // Never the predictions of the user signed in before
  const current = mine && mine.userId === userId ? mine : null;
  const bracket = fresh ?? initial;
  const champion = championOf(bracket);

  return (
    <>
      <LiveStatus status={status} announcement={message} />
      {champion && (
        <p className="oc-card heading flex items-center gap-2 border-2 border-brand text-brand">
          <Icon name="check" />
          {champion} remporte le tournoi.
        </p>
      )}
      {!loading && !user && (
        <p>
          <Link
            href={loginPath(routes.tournament(slug))}
            className="underline underline-offset-4"
          >
            Connecte-toi
          </Link>{" "}
          pour faire tes pronostics.
        </p>
      )}
      {user && (
        <div className="flex flex-col items-start gap-3">
          <button
            ref={mineButton}
            type="button"
            aria-haspopup="dialog"
            className={buttonClass}
            onClick={() => setShowMine(true)}
          >
            Mes pronostics
          </button>
          <p role="status" className={current || error ? "sr-only" : ""}>
            {!current && !error && "Chargement de tes pronostics…"}
          </p>
          {error && (
            <>
              <ErrorMessage>{error}</ErrorMessage>
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  // This button goes away: focus the one that stays
                  mineButton.current?.focus();
                  setError("");
                  read().catch(() => {});
                }}
              >
                Réessayer
              </button>
            </>
          )}
        </div>
      )}
      <BracketSwitcher
        bracket={bracket}
        renderPrediction={
          current
            ? (match) => (
                <MatchPrediction
                  match={match}
                  prediction={current.predictions.get(match.id)}
                  onSaved={(saved) => {
                    setMine(
                      (before) =>
                        before && {
                          ...before,
                          predictions: new Map(before.predictions).set(
                            match.id,
                            saved,
                          ),
                        },
                    );
                    // An answer on its way may not have this prediction
                    if (running.current) read().catch(() => {});
                  }}
                  onRefused={() => read().catch(() => {})}
                />
              )
            : undefined
        }
      />
      {user && showMine && (
        <MyPredictions updates={updates} onClose={() => setShowMine(false)} />
      )}
    </>
  );
}
