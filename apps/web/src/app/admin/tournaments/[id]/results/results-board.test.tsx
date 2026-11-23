/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from "@jest/globals";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  Bracket,
  BracketMatch,
  BracketSlot,
  Tournament,
} from "@/lib/api/models";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi } from "@/test/fake-api";
import { ResultsBoard } from "./results-board";

const tournament: Tournament = {
  id: "t1",
  slug: "winter-cup",
  name: "Winter Cup",
  game: { id: "g1", name: "Rocket League" },
  description: null,
  startsAt: null,
  endsAt: null,
  timezone: "Europe/Paris",
  status: "running",
  owner: { id: "u1", displayName: "admin" },
};

const slot = (
  position: number,
  name: string | null,
  extra: Partial<BracketSlot> = {},
): BracketSlot => ({
  position,
  state: name ? "assigned" : "open",
  seed: null,
  team: name ? { id: `id-${name}`, name, tag: null } : null,
  score: null,
  winner: false,
  ...extra,
});

const match = (
  n: number,
  slots: BracketSlot[],
  extra: Partial<BracketMatch> = {},
): BracketMatch => ({
  id: `m${n}`,
  label: `Match ${n}`,
  position: n,
  state: "pending",
  hasResult: false,
  slots,
  ...extra,
});

const bracketOf = (semis: BracketMatch[], final: BracketMatch): Bracket => ({
  stage: { id: "s1", name: "Bracket", format: "single_elim", seeding: "auto" },
  rounds: [
    { round: 1, matches: semis },
    { round: 2, matches: [final] },
  ],
});

// Alpha against Delta, Bravo against Charlie, the final still open
const start = bracketOf(
  [
    match(1, [slot(1, "Alpha"), slot(2, "Delta")]),
    match(2, [slot(1, "Bravo"), slot(2, "Charlie")]),
  ],
  match(3, [slot(1, null), slot(2, null)]),
);

// After Match 1: Alpha won 3-1 and is in the final
const afterMatch1 = bracketOf(
  [
    match(
      1,
      [
        slot(1, "Alpha", { score: 3, winner: true }),
        slot(2, "Delta", { score: 1 }),
      ],
      { state: "decided", hasResult: true },
    ),
    start.rounds[0].matches[1],
  ],
  match(3, [slot(1, "Alpha"), slot(2, null)]),
);

function setup(bracket: Bracket = start) {
  const fake = fakeApi({
    "GET /tournaments/t1": [200, tournament],
    "GET /tournaments/t1/bracket": [200, bracket],
  });
  const refresh = jest.fn<(slug: string) => Promise<void>>(async () => {});
  const view = render(<ResultsBoard id="t1" onResultSaved={refresh} />);
  return { fake, refresh, ui: userEvent.setup(), ...view };
}

const card = (label: string) =>
  screen.getByRole("heading", { level: 3, name: label }).closest("li")!;

describe("ResultsBoard", () => {
  it("draws the rounds and says in words who won and who is out", async () => {
    setup(afterMatch1);
    await screen.findByRole("heading", { name: "Demi-finales" });
    expect(screen.getByRole("heading", { name: "Finale" })).toBeTruthy();

    const played = within(card("Match 1"));
    expect(
      played.getByText("Vainqueur").closest("span")?.parentElement?.textContent,
    ).toContain("Alpha");
    expect(played.getByText("Éliminé")).toBeTruthy();
    expect(played.getByText("Terminé")).toBeTruthy();
    expect(
      within(card("Match 3")).getByText("En attente des équipes"),
    ).toBeTruthy();
    expect(within(card("Match 3")).getByText("À déterminer")).toBeTruthy();
  });

  it("shows the same matches as a table", async () => {
    const { ui } = setup(afterMatch1);
    const table = await screen.findByRole("button", { name: "Tableau" });
    await ui.click(table);
    expect(table.getAttribute("aria-pressed")).toBe("true");

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        [...row.children].slice(0, 6).map((cell) => cell.textContent),
      ),
    ).toEqual([
      [
        "Demi-finales",
        "Match 1",
        "Alpha Vainqueur",
        "3 – 1",
        "Delta Éliminé",
        "Terminé",
      ],
      ["Demi-finales", "Match 2", "Bravo", "—", "Charlie", "À jouer"],
      [
        "Finale",
        "Match 3",
        "Alpha",
        "—",
        "À déterminer",
        "En attente des équipes",
      ],
    ]);
  });

  it("enters a result, announces where the winner goes, and returns focus", async () => {
    const { fake, refresh, ui } = setup();
    await ui.click(
      await screen.findByRole("button", {
        name: "Saisir le résultat de Match 1",
      }),
    );
    const heading = screen.getByRole("heading", {
      name: "Résultat de Match 1 : Alpha contre Delta",
    });
    expect(document.activeElement).toBe(heading);
    // No reason to give on a first entry
    expect(screen.queryByLabelText("Raison de la correction")).toBeNull();

    await ui.type(screen.getByLabelText("Score d'Alpha"), "3");
    await ui.type(screen.getByLabelText("Score de Delta"), "1");
    await ui.click(screen.getByRole("radio", { name: "Alpha" }));
    fake.set("POST /matches/m1/result", [201, afterMatch1]);
    await ui.click(
      screen.getByRole("button", { name: "Enregistrer le résultat" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Alpha gagne Match 1 et passe en finale.",
      ),
    );
    expect(
      fake.calls.find((c) => c.route === "POST /matches/m1/result")?.body,
    ).toEqual({
      scores: [3, 1],
      winnerSlot: 1,
    });
    // The public page is refreshed for visitors
    expect(refresh).toHaveBeenCalledWith("winter-cup");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Corriger de Match 1" }),
      ),
    );
  });

  it("corrects a result from the table, with a reason", async () => {
    const { fake, ui } = setup(afterMatch1);
    await ui.click(await screen.findByRole("button", { name: "Tableau" }));
    await ui.click(screen.getByRole("button", { name: "Corriger de Match 1" }));

    // Starts from the current result
    expect(screen.getByLabelText<HTMLInputElement>("Score d'Alpha").value).toBe(
      "3",
    );
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "Alpha" }).checked,
    ).toBe(true);

    const corrected = bracketOf(
      [
        match(
          1,
          [
            slot(1, "Alpha", { score: 1 }),
            slot(2, "Delta", { score: 3, winner: true }),
          ],
          { state: "decided", hasResult: true },
        ),
        start.rounds[0].matches[1],
      ],
      match(3, [slot(1, "Delta"), slot(2, null)]),
    );
    fake.set("POST /matches/m1/result", [201, corrected]);
    await ui.clear(screen.getByLabelText("Score d'Alpha"));
    await ui.type(screen.getByLabelText("Score d'Alpha"), "1");
    await ui.clear(screen.getByLabelText("Score de Delta"));
    await ui.type(screen.getByLabelText("Score de Delta"), "3");
    await ui.click(screen.getByRole("radio", { name: "Delta" }));
    await ui.type(
      screen.getByLabelText("Raison de la correction"),
      "Scores inversés",
    );
    await ui.click(
      screen.getByRole("button", { name: "Enregistrer la correction" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Delta gagne Match 1 et passe en finale.",
      ),
    );
    expect(fake.calls.at(-2)?.body).toEqual({
      scores: [1, 3],
      winnerSlot: 2,
      reason: "Scores inversés",
    });
  });

  it("explains a refused score in French and focuses what to fix", async () => {
    const { fake, refresh, ui } = setup();
    fake.set("POST /matches/m1/result", [
      400,
      {
        message: [
          "A match cannot end in a tie: enter the score that decided it",
        ],
        errors: {
          scores: [
            "A match cannot end in a tie: enter the score that decided it",
          ],
        },
      },
    ]);
    await ui.click(
      await screen.findByRole("button", {
        name: "Saisir le résultat de Match 1",
      }),
    );
    await ui.type(screen.getByLabelText("Score d'Alpha"), "2");
    await ui.type(screen.getByLabelText("Score de Delta"), "2");
    await ui.click(screen.getByRole("radio", { name: "Alpha" }));
    await ui.click(
      screen.getByRole("button", { name: "Enregistrer le résultat" }),
    );

    const alpha = screen.getByLabelText("Score d'Alpha");
    await waitFor(() => expect(document.activeElement).toBe(alpha));
    expect(alpha.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(alpha.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe(
      "Un match ne peut pas finir à égalité : saisis le score qui a départagé les équipes.",
    );
    // Nothing announced until a result is saved
    expect(screen.getByRole("status").textContent).toBe("");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("points out a match made stale by a correction, in the same announcement", async () => {
    const staleFinal = bracketOf(
      afterMatch1.rounds[0].matches,
      match(
        3,
        [slot(1, "Alpha", { score: 2 }), slot(2, "Bravo", { score: 0 })],
        {
          state: "stale",
          hasResult: true,
        },
      ),
    );
    const { fake, ui } = setup(afterMatch1);
    await ui.click(
      await screen.findByRole("button", { name: "Corriger de Match 1" }),
    );
    fake.set("POST /matches/m1/result", [201, staleFinal]);
    await ui.type(screen.getByLabelText("Raison de la correction"), "Erreur");
    await ui.click(
      screen.getByRole("button", { name: "Enregistrer la correction" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Alpha gagne Match 1 et passe en finale. Match 3 est à corriger : ses équipes ont changé.",
      ),
    );
    expect(
      screen.getByText(/Match 3 est à corriger : un résultat précédent/),
    ).toBeTruthy();
    expect(
      within(card("Match 3")).getByText("À corriger : les équipes ont changé"),
    ).toBeTruthy();
  });

  it("cancels the form and returns to the match", async () => {
    const { ui } = setup();
    const open = await screen.findByRole("button", {
      name: "Saisir le résultat de Match 2",
    });
    await ui.click(open);
    await ui.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Saisir le résultat de Match 2" }),
      ),
    );
  });

  it("says when the tournament has no bracket yet", async () => {
    fakeApi({
      "GET /tournaments/t1": [200, { ...tournament, status: "draft" }],
      "GET /tournaments/t1/bracket": [
        404,
        { message: "This tournament has no bracket yet" },
      ],
    });
    render(<ResultsBoard id="t1" />);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Ce tournoi n'a pas encore d'arbre : génère-le depuis la page du tournoi.",
    );
  });

  it("passes the axe checks in both views, form open", async () => {
    const { ui, container } = setup(afterMatch1);
    await ui.click(
      await screen.findByRole("button", { name: "Corriger de Match 1" }),
    );
    await expectNoAxeViolations(container);
    await ui.click(screen.getByRole("button", { name: "Tableau" }));
    await expectNoAxeViolations(container);
  });
});
