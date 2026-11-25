/**
 * @jest-environment jsdom
 */
import "@/test/mock-navigation";
import { afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bracket, BracketMatch, Prediction } from "@/lib/api/models";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi, signedOut, user } from "@/test/fake-api";
import { toastMessages, withToasts } from "@/test/toasts";
import { PredictionBoard } from "./prediction-board";

const alpha = { id: "a", name: "Alpha", tag: null };
const bravo = { id: "b", name: "Bravo", tag: null };

const match = (
  n: number,
  predictionLock: BracketMatch["predictionLock"],
): BracketMatch => ({
  id: `m${n}`,
  label: `Match ${n}`,
  position: n,
  state: predictionLock === "played" ? "decided" : "pending",
  hasResult: predictionLock === "played",
  predictionLock,
  slots: [alpha, bravo].map((team, i) => ({
    position: i + 1,
    state: predictionLock === "teams-unknown" ? "open" : "assigned",
    seed: i + 1,
    team: predictionLock === "teams-unknown" ? null : team,
    score: predictionLock === "played" ? 2 - i : null,
    winner: predictionLock === "played" && i === 0,
  })),
});

const bracketOf = (...matches: BracketMatch[]): Bracket => ({
  stage: { id: "s1", name: "Bracket", format: "single_elim", seeding: "auto" },
  rounds: [{ round: 1, matches }],
});

const prediction = (n: number, over: Partial<Prediction> = {}): Prediction => ({
  id: `p${n}`,
  tournament: { id: "t1", slug: "coupe", name: "Coupe" },
  match: {
    id: `m${n}`,
    label: `Match ${n}`,
    round: 1,
    scheduledAt: null,
    teams: [alpha, bravo],
  },
  team: alpha,
  score: null,
  status: "pending",
  points: 0,
  locked: false,
  ...over,
});

const bracket = bracketOf(
  match(1, null),
  match(2, "started"),
  match(3, "played"),
  match(4, "played"),
  match(5, "teams-unknown"),
);

const signedIn = (
  predictions: Prediction[],
  more: Parameters<typeof fakeApi>[0] = {},
) =>
  fakeApi({
    "GET /auth/me": [200, user],
    "GET /tournaments/t1/bracket": [200, bracket],
    "GET /me/predictions": [200, predictions],
    ...more,
  });

function renderBoard() {
  const { container } = render(
    withToasts(
      <AuthProvider>
        <PredictionBoard
          tournament={{ id: "t1", slug: "coupe" }}
          bracket={bracket}
        />
      </AuthProvider>,
    ),
  );
  return { container, ui: userEvent.setup() };
}

const predictButton = (n: number) =>
  screen.findByRole("button", { name: `Pronostiquer, Match ${n}` });
const card = (n: number) =>
  within(
    screen
      .getByRole("heading", { name: `Match ${n}` })
      .closest("li") as HTMLElement,
  );

// jsdom does not implement showModal and close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(cleanup);

describe("PredictionBoard", () => {
  it("offers visitors to sign in, and comes back to the tournament", async () => {
    fakeApi({
      "GET /auth/me": [401, signedOut],
      "POST /auth/refresh": [401, signedOut],
    });
    renderBoard();
    const link = await screen.findByRole("link", { name: "Connecte-toi" });
    expect(link.getAttribute("href")).toBe(
      "/login?next=%2Ftournaments%2Fcoupe",
    );
    expect(screen.queryByRole("button", { name: /Pronostiquer/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mes pronostics" })).toBeNull();
  });

  it("shows the state of each match in words", async () => {
    signedIn([
      prediction(2, { locked: true }),
      prediction(3, { locked: true, status: "correct", points: 3 }),
      prediction(4, { locked: true, status: "wrong", team: bravo }),
    ]);
    const { container, ui } = renderBoard();
    await predictButton(1);
    expect(card(1).getByText("Ouvert")).toBeTruthy();
    expect(card(2).getByText("Verrouillé")).toBeTruthy();
    expect(card(3).getByText("Juste")).toBeTruthy();
    expect(card(3).getByText(/3 points/)).toBeTruthy();
    expect(card(4).getByText("Faux")).toBeTruthy();
    expect(card(5).getByText("À venir")).toBeTruthy();
    expect(card(5).getByText(/quand les deux équipes/)).toBeTruthy();
    // Only the open match can be predicted
    expect(
      screen.getAllByRole("button", { name: /Pronostiquer|Modifier/ }),
    ).toHaveLength(1);
    await expectNoAxeViolations(container);

    await ui.click(screen.getByRole("button", { name: "Tableau" }));
    expect(
      screen.getByRole("columnheader", { name: "Mon pronostic" }),
    ).toBeTruthy();
    await predictButton(1);
    await expectNoAxeViolations(container);
  });

  it("saves a winner and an exact score with the keyboard, then edits them", async () => {
    const fake = signedIn([], {
      "POST /predictions": [201, prediction(1, { score: [3, 1] })],
      "PATCH /predictions/p1": [200, prediction(1, { team: bravo })],
    });
    const { container, ui } = renderBoard();
    (await predictButton(1)).focus();
    await ui.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Alpha" }),
    );
    await expectNoAxeViolations(container);
    await ui.keyboard(" {Tab}3{Tab}1{Enter}");

    const edit = await screen.findByRole("button", {
      name: "Modifier mon pronostic, Match 1",
    });
    expect(document.activeElement).toBe(edit);
    expect(card(1).getByText("Alpha (3 – 1)")).toBeTruthy();
    expect(toastMessages("polite")).toEqual([
      "Pronostic enregistré pour Match 1.",
    ]);
    expect(fake.calls.at(-1)).toEqual({
      route: "POST /predictions",
      body: { matchId: "m1", teamId: "a", score: [3, 1] },
    });

    await ui.click(edit);
    const score = screen.getByLabelText("Score de Alpha") as HTMLInputElement;
    expect(score.value).toBe("3");
    await ui.click(screen.getByRole("radio", { name: "Bravo" }));
    await ui.clear(score);
    await ui.clear(screen.getByLabelText("Score de Bravo"));
    await ui.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(card(1).getByText("Bravo", { selector: "strong" })).toBeTruthy(),
    );
    // Both scores emptied: the exact score is removed
    expect(fake.calls.at(-1)).toEqual({
      route: "PATCH /predictions/p1",
      body: { teamId: "b", score: null },
    });
  });

  it("predicts and edits from the table", async () => {
    const fake = signedIn([], {
      "POST /predictions": [201, prediction(1, { score: [2, 1] })],
    });
    const { container, ui } = renderBoard();
    await predictButton(1);
    await ui.click(screen.getByRole("button", { name: "Tableau" }));
    await ui.click(await predictButton(1));
    const row = screen
      .getByRole("rowheader", { name: "Match 1" })
      .closest("tr") as HTMLElement;
    await ui.click(within(row).getByRole("radio", { name: "Alpha" }));
    await ui.type(within(row).getByLabelText("Score de Alpha"), "2");
    await ui.type(within(row).getByLabelText("Score de Bravo"), "1");
    await expectNoAxeViolations(container);
    await ui.click(within(row).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(within(row).getByText("Alpha (2 – 1)")).toBeTruthy(),
    );
    expect(fake.count("POST /predictions")).toBe(1);
    expect(document.activeElement).toBe(
      within(row).getByRole("button", {
        name: "Modifier mon pronostic, Match 1",
      }),
    );
    // The bracket has it too
    await ui.click(screen.getByRole("button", { name: "Arbre" }));
    expect(card(1).getByText("Alpha (2 – 1)")).toBeTruthy();
  });

  it("cancels with Escape, without saving, and gives focus back", async () => {
    const fake = signedIn([]);
    const { ui } = renderBoard();
    await ui.click(await predictButton(1));
    await ui.keyboard("{Escape}");
    expect(document.activeElement).toBe(await predictButton(1));
    expect(fake.count("POST /predictions")).toBe(0);
  });

  it("explains a refused score next to the scores", async () => {
    const message = "score must give the picked team the higher score";
    signedIn([], {
      "POST /predictions": [
        400,
        { message: [message], errors: { score: [message] } },
      ],
    });
    const { ui } = renderBoard();
    await ui.click(await predictButton(1));
    await ui.click(screen.getByRole("radio", { name: "Bravo" }));
    await ui.click(screen.getByRole("button", { name: "Enregistrer" }));
    const error = await screen.findByText(/doit avoir le plus haut score/);
    const input = screen.getByLabelText("Score de Alpha");
    expect(input.getAttribute("aria-describedby")).toBe(error.closest("p")!.id);
    expect(document.activeElement).toBe(input);
  });

  it("shows a match locked when the server refuses the prediction", async () => {
    const fake = signedIn([], {
      "POST /predictions": [
        409,
        { code: "prediction_locked", reason: "started", message: "Locked" },
      ],
    });
    const { ui } = renderBoard();
    await ui.click(await predictButton(1));
    await ui.click(screen.getByRole("radio", { name: "Alpha" }));
    fake.set("GET /tournaments/t1/bracket", [
      200,
      bracketOf(match(1, "started")),
    ]);
    await ui.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(card(1).getByText("Verrouillé")).toBeTruthy());
    expect(toastMessages("error")).toEqual([
      "Pronostic refusé : le match a commencé, les pronostics sont verrouillés.",
    ]);
    // Not lost on a button that is gone
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("Verrouillé"),
    );
  });

  it("lets a cancelled prediction be made again", async () => {
    signedIn([prediction(1, { status: "cancelled", team: null })]);
    renderBoard();
    await screen.findByRole("button", {
      name: "Modifier mon pronostic, Match 1",
    });
    expect(card(1).getByText("Annulé")).toBeTruthy();
  });

  it("still shows the matches when predictions fail to load, and retries", async () => {
    const fake = signedIn([], {
      "GET /me/predictions": [500, { message: "Internal server error" }],
    });
    const { ui } = renderBoard();
    expect(screen.getByRole("heading", { name: "Match 1" })).toBeTruthy();
    expect(
      await screen.findByText(/Le serveur a rencontré un problème/),
    ).toBeTruthy();
    fake.set("GET /me/predictions", [200, []]);
    await ui.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await predictButton(1)).toBeTruthy();
    expect(screen.queryByText(/Le serveur a rencontré/)).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Mes pronostics" }),
    );
  });
});

describe("My predictions window", () => {
  const openWindow = async (ui: ReturnType<typeof userEvent.setup>) => {
    const button = await screen.findByRole("button", {
      name: "Mes pronostics",
    });
    await ui.click(button);
    return { button, dialog: screen.getByRole("dialog") };
  };

  it("lists match, pick, status and points with totals", async () => {
    signedIn([
      prediction(1, { score: [2, 0] }),
      prediction(3, { locked: true, status: "correct", points: 5 }),
      prediction(6, {
        locked: true,
        status: "correct",
        points: 4,
        tournament: { id: "t2", slug: "autre", name: "Autre coupe" },
      }),
    ]);
    const { container, ui } = renderBoard();
    const { dialog } = await openWindow(ui);
    expect((await within(dialog).findByText(/^Total :/)).textContent).toBe(
      "Total : 9 points",
    );
    const table = within(dialog).getByRole("table", { name: "Coupe" });
    const rows = within(table)
      .getAllByRole("row")
      .map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ["Match", "Pronostic", "Statut", "Points"],
      ["Match 1Alpha contre Bravo", "Alpha (2 – 0)", "Ouvert", "0"],
      ["Match 3Alpha contre Bravo", "Alpha", "Juste", "5"],
      ["Total du tournoi", "5"],
    ]);
    await expectNoAxeViolations(container);
  });

  it("keeps Tab inside, closes on Escape and returns focus", async () => {
    signedIn([]);
    const { ui } = renderBoard();
    const { button, dialog } = await openWindow(ui);
    await within(dialog).findByText(/pas encore de pronostic/);
    expect(document.activeElement).toBe(
      within(dialog).getByRole("heading", { name: "Mes pronostics" }),
    );
    for (let i = 0; i < 4; i++) {
      await ui.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await ui.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await ui.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("says when it loads, and lets the user retry after an error", async () => {
    const fake = signedIn([]);
    const { ui } = renderBoard();
    await predictButton(1);
    fake.set("GET /me/predictions", [500, {}]);
    const { dialog } = await openWindow(ui);
    expect(within(dialog).getByRole("alert")).toBeTruthy();
    fake.set("GET /me/predictions", [200, [prediction(1)]]);
    await ui.click(within(dialog).getByRole("button", { name: "Réessayer" }));
    expect(await within(dialog).findByRole("table")).toBeTruthy();
    // The button that had focus is gone: focus stays in the window
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("shows a loading message first", async () => {
    signedIn([]);
    const { ui } = renderBoard();
    const button = await screen.findByRole("button", {
      name: "Mes pronostics",
    });
    const real = global.fetch;
    global.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;
    await ui.click(button);
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Chargement de tes pronostics…",
      ),
    ).toBeTruthy();
    global.fetch = real;
  });
});
