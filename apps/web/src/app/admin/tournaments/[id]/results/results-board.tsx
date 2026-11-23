"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Bracket, BracketMatch, Tournament } from "@/lib/api/models";
import { explainMessage } from "@/lib/forms/explain";
import { routes } from "@/lib/routes";
import { StatusBadge } from "@/components/tournament-status";
import {
  announceResult,
  needsAttention,
} from "@/components/bracket/bracket-text";
import { BracketSwitcher } from "@/components/bracket/bracket-switcher";
import { ResultForm } from "./result-form";

// Enter and correct the results of a running tournament, from the bracket
// or from the table of matches: both show the same data and open the same
// form, one match at a time.
export function ResultsBoard({
  id,
  onResultSaved,
}: {
  id: string;
  // Refreshes the public page of the tournament (a server action)
  onResultSaved?: (slug: string) => Promise<void>;
}) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [open, setOpen] = useState<BracketMatch | null>(null);
  // Match whose button gets focus back once the form closes
  const returnTo = useRef<string | null>(null);
  const [loadError, setLoadError] = useState("");
  // Only set after a save: loading or switching views says nothing
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Tournament>(`/tournaments/${id}`),
      api.get<Bracket>(`/tournaments/${id}/bracket`),
    ])
      .then(([t, b]) => {
        setTournament(t);
        setBracket(b);
      })
      .catch((caught: unknown) =>
        setLoadError(
          isApiError(caught)
            ? caught.status === 404 && caught.message.includes("bracket")
              ? "Ce tournoi n'a pas encore d'arbre : génère-le depuis la page du tournoi."
              : explainMessage(caught.message)
            : "Impossible de charger les résultats. Réessaie dans un instant.",
        ),
      );
  }, [id]);

  useEffect(() => {
    if (open || !returnTo.current) return;
    document
      .querySelector<HTMLButtonElement>(
        `button[data-match="${returnTo.current}"]`,
      )
      ?.focus();
    returnTo.current = null;
  }, [open]);

  function close() {
    returnTo.current = open?.id ?? null;
    setOpen(null);
  }

  async function saved(next: Bracket) {
    const matchId = open!.id;
    setBracket(next);
    setAnnouncement(announceResult(next, matchId));
    close();
    // Visitors see the result at once; a failure only delays it until the
    // cache expires, so it is not shown
    onResultSaved?.(tournament!.slug).catch(() => {});
    // The final decides whether the tournament is finished
    setTournament(await api.get<Tournament>(`/tournaments/${id}`));
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12">
        <p role="alert">{loadError}</p>
        <Link
          href={routes.admin.tournament(id)}
          className="underline underline-offset-4"
        >
          Retour au tournoi
        </Link>
      </div>
    );
  }
  if (!tournament || !bracket) {
    return <p className="px-4 py-12 text-center">Chargement des résultats…</p>;
  }

  const toFix = bracket.rounds.flatMap((r) => r.matches).filter(needsAttention);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12">
      <Link
        href={routes.admin.tournament(id)}
        className="underline underline-offset-4"
      >
        Retour au tournoi
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Résultats · {tournament.name}</h1>
        <p className="flex flex-wrap items-center gap-3">
          <span>Statut :</span> <StatusBadge status={tournament.status} />
        </p>
      </header>

      {/* Polite and replaced at each save, never appended */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {toFix.length > 0 && (
        <p className="rounded-md border-2 border-dashed p-3">
          <span aria-hidden="true">⚠ </span>
          {toFix.length === 1
            ? `${toFix[0].label} est à corriger : un résultat précédent a changé ses équipes.`
            : `${toFix.length} matchs sont à corriger : ${toFix.map((m) => m.label).join(", ")}.`}
        </p>
      )}

      <BracketSwitcher bracket={bracket} onOpen={(match) => setOpen(match)}>
        {open && (
          <ResultForm
            key={open.id}
            match={open}
            onSaved={saved}
            onCancel={close}
          />
        )}
      </BracketSwitcher>
    </div>
  );
}
