/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bracket } from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { BracketSwitcher } from "./bracket-switcher";

const bracket: Bracket = {
  stage: { id: "s1", name: "Bracket", format: "single_elim", seeding: "auto" },
  rounds: [
    {
      round: 1,
      matches: [
        {
          id: "m1",
          label: "Match 1",
          position: 1,
          state: "decided",
          hasResult: true,
          slots: [
            {
              position: 1,
              state: "assigned",
              seed: 1,
              team: { id: "a", name: "Alpha", tag: null },
              score: 2,
              winner: true,
            },
            {
              position: 2,
              state: "assigned",
              seed: 2,
              team: { id: "b", name: "Bravo", tag: null },
              score: 0,
              winner: false,
            },
          ],
        },
      ],
    },
  ],
};

describe("BracketSwitcher, read-only", () => {
  it("shows both views without any result button", async () => {
    const ui = userEvent.setup();
    const { container } = render(<BracketSwitcher bracket={bracket} />);
    expect(screen.getByRole("heading", { name: "Finale" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Saisir|Corriger/ }),
    ).toBeNull();
    await expectNoAxeViolations(container);

    await ui.click(screen.getByRole("button", { name: "Tableau" }));
    const header = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(header).toEqual([
      "Tour",
      "Match",
      "Équipe 1",
      "Score",
      "Équipe 2",
      "État",
    ]);
    expect(screen.getByRole("cell", { name: "2 – 0" })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
