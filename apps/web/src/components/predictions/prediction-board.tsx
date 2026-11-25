"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BracketSwitcher } from "@/components/bracket/bracket-switcher";
import { ErrorMessage } from "@/components/messages";
import { buttonClass } from "@/components/styles";
import { apiErrorMessage } from "@/components/toast/api-error-message";
import { api } from "@/lib/api/client";
import type { Bracket, Prediction, Tournament } from "@/lib/api/models";
import { useAuth } from "@/lib/auth/auth-provider";
import { loginPath } from "@/lib/auth/return-path";
import { routes } from "@/lib/routes";
import { MatchPrediction } from "./match-prediction";
import { MyPredictions } from "./my-predictions";

// What a signed-in user sees: the bracket as it is now, since the page's
// own copy is cached, and their predictions by match
interface Mine {
  userId: string;
  bracket: Bracket;
  predictions: Map<string, Prediction>;
}

/**
 * The public bracket and, for a signed-in user, their prediction on each
 * match. Visitors and users whose predictions did not load still get the
 * bracket.
 */
export function PredictionBoard({
  tournament,
  bracket,
}: {
  tournament: Pick<Tournament, "id" | "slug">;
  bracket: Bracket;
}) {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const { id, slug } = tournament;
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  const [showMine, setShowMine] = useState(false);
  const mineButton = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return;
      try {
        const [fresh, predictions] = await Promise.all([
          api.get<Bracket>(`/tournaments/${id}/bracket`, { signal }),
          api.get<Prediction[]>("/me/predictions", {
            query: { tournament: id },
            signal,
          }),
        ]);
        if (signal?.aborted) return;
        setMine({
          userId,
          bracket: fresh,
          predictions: new Map(predictions.map((p) => [p.match.id, p])),
        });
        setError("");
      } catch (caught) {
        if (signal?.aborted) return;
        setError(
          apiErrorMessage(
            caught,
            "Impossible de charger tes pronostics. Réessaie dans un instant.",
          ),
        );
      }
    },
    [id, userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- set after the calls
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Never the predictions of the user signed in before
  const current = mine && mine.userId === userId ? mine : null;

  return (
    <>
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
                  void load();
                }}
              >
                Réessayer
              </button>
            </>
          )}
        </div>
      )}
      <BracketSwitcher
        bracket={current?.bracket ?? bracket}
        renderPrediction={
          current
            ? (match) => (
                <MatchPrediction
                  match={match}
                  prediction={current.predictions.get(match.id)}
                  onSaved={(saved) =>
                    setMine(
                      (before) =>
                        before && {
                          ...before,
                          predictions: new Map(before.predictions).set(
                            match.id,
                            saved,
                          ),
                        },
                    )
                  }
                  onRefused={() => load()}
                />
              )
            : undefined
        }
      />
      {user && showMine && <MyPredictions onClose={() => setShowMine(false)} />}
    </>
  );
}
