"use client";

import { useState, type ReactNode } from "react";
import type { Bracket, BracketMatch } from "@/lib/api/models";
import { BracketView } from "./bracket-view";
import { TableView } from "./table-view";

type View = "bracket" | "table";

const views: { value: View; label: string }[] = [
  { value: "bracket", label: "Arbre" },
  { value: "table", label: "Tableau" },
];

/**
 * The matches of a tournament as a bracket or as a table, which show the
 * same data. `children` goes between the switch and the matches (the
 * admin's result form). Without `onOpen`, both views are read-only.
 */
export function BracketSwitcher({
  bracket,
  onOpen,
  busy,
  children,
}: {
  bracket: Bracket;
  onOpen?: (match: BracketMatch, button: HTMLButtonElement) => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  const [view, setView] = useState<View>("bracket");
  const Matches = view === "bracket" ? BracketView : TableView;
  return (
    <>
      <div role="group" aria-label="Affichage" className="flex gap-2">
        {views.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={view === option.value}
            onClick={() => setView(option.value)}
            className={`min-h-11 rounded-md border-2 px-4 ${
              view === option.value
                ? "font-bold underline underline-offset-4"
                : ""
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {children}
      <Matches bracket={bracket} onOpen={onOpen} busy={busy} />
    </>
  );
}
