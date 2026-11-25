/**
 * @jest-environment jsdom
 */
import "@/test/mock-navigation";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Leaderboard, LeaderboardEntry } from "@/lib/api/models";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { expectNoAxeViolations } from "@/test/axe";
import { fakeApi, signedOut, user } from "@/test/fake-api";
import { FakeEventSource } from "@/test/fake-event-source";
import { LeaderboardBoard } from "./leaderboard-board";

const entry = (
  rank: number,
  id: string,
  points: number,
  correctPicks = 1,
): LeaderboardEntry => ({
  rank,
  user: { id, displayName: `Joueur ${id}` },
  points,
  correctPicks,
  predictions: 4,
});

const board = (over: Partial<Leaderboard> = {}): Leaderboard => ({
  version: "1",
  page: 1,
  pageSize: 20,
  total: 2,
  entries: [entry(1, "x", 9, 3), entry(2, user.id, 6, 2)],
  me: entry(2, user.id, 6, 2),
  ...over,
});

const PATH = "GET /tournaments/t1/leaderboard";

function setup(first: Leaderboard, signedIn = true) {
  const fake = fakeApi({
    "GET /auth/me": signedIn ? [200, user] : [401, signedOut],
    "POST /auth/refresh": [401, signedOut],
    [PATH]: [200, first],
  });
  const view = render(
    <AuthProvider>
      <LeaderboardBoard tournamentId="t1" slug="coupe" />
    </AuthProvider>,
  );
  return { fake, ui: userEvent.setup(), ...view };
}

const rows = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .map((row) => [...row.children].map((cell) => cell.textContent));
const announced = () =>
  screen.getByRole("status", { name: "Mises à jour" }).textContent;

beforeEach(() => FakeEventSource.install());
afterEach(cleanup);

describe("LeaderboardBoard", () => {
  it("shows a table with my row marked in words", async () => {
    const { container } = setup(board());
    await screen.findByRole("table");
    expect(rows()).toEqual([
      ["Rang", "Participant", "Points", "Bons pronostics"],
      ["1", "Joueur x", "9", "3 sur 4"],
      ["2", `Joueur ${user.id} (toi)`, "6", "2 sur 4"],
    ]);
    expect(
      screen
        .getByRole("rowheader", { name: /toi/ })
        .closest("tr")
        ?.getAttribute("aria-current"),
    ).toBe("true");
    await expectNoAxeViolations(container);
  });

  it("keeps my row in sight when it is on another page", async () => {
    setup(
      board({
        total: 45,
        entries: [entry(1, "x", 9)],
        me: entry(41, user.id, 0),
      }),
    );
    await screen.findByRole("table");
    expect(rows().at(-1)?.slice(0, 2)).toEqual([
      "41",
      `Joueur ${user.id} (toi)`,
    ]);
  });

  it("pages through the ranking, keeping focus on the button", async () => {
    const { fake, ui } = setup(board({ total: 21 }));
    const next = await screen.findByRole("button", { name: "Page suivante" });
    expect(
      screen
        .getByRole("button", { name: "Page précédente" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    fake.set(PATH, [
      200,
      board({ page: 2, total: 21, entries: [entry(21, "z", 0)] }),
    ]);
    await ui.click(next);
    expect(await screen.findByText("Page 2 sur 2")).toBeTruthy();
    expect(document.activeElement).toBe(next);
    const calls = fake.count(PATH);
    await ui.click(next);
    expect(fake.count(PATH)).toBe(calls);
    // Changing page is not news
    expect(announced()).toBe("");
  });

  it("updates live and says my place once", async () => {
    const { fake } = setup(board());
    await screen.findByRole("table");
    act(() => FakeEventSource.last.sync("1"));
    await waitFor(() => expect(fake.count(PATH)).toBeGreaterThan(1));
    expect(announced()).toBe("");

    const mine = entry(1, user.id, 12, 4);
    fake.set(PATH, [
      200,
      board({ version: "2", entries: [mine, entry(2, "x", 9, 3)], me: mine }),
    ]);
    act(() => FakeEventSource.last.change("2"));
    await waitFor(() => expect(rows()[1][1]).toContain("(toi)"));
    await waitFor(() =>
      expect(announced()).toBe(
        "Classement mis à jour. Tu es 1er avec 12 points.",
      ),
    );
  });

  it("recovers what was missed while the connection was down", async () => {
    const { fake } = setup(board());
    await screen.findByRole("table");
    act(() => FakeEventSource.last.sync("1"));
    await waitFor(() => expect(fake.count(PATH)).toBe(2));
    act(() => FakeEventSource.last.fail(false));
    fake.set(PATH, [200, board({ entries: [entry(1, "x", 20)], total: 1 })]);
    act(() => FakeEventSource.last.sync("5"));
    await waitFor(() => expect(rows()[1][2]).toBe("20"));
  });

  it("keeps the ranking when a live update fails", async () => {
    const { fake } = setup(board());
    await screen.findByRole("table");
    fake.set(PATH, [500, {}]);
    act(() => FakeEventSource.last.sync("1"));
    await waitFor(() => expect(fake.count(PATH)).toBe(2));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("invites visitors to sign in, and explains an empty ranking", async () => {
    setup(board({ total: 0, entries: [], me: null }), false);
    expect(await screen.findByText(/Personne n'a encore/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Connecte-toi" }).getAttribute("href"),
    ).toBe("/login?next=%2Ftournaments%2Fcoupe%2Fleaderboard");
  });

  it("explains a loading error and retries", async () => {
    const fake = fakeApi({
      "GET /auth/me": [200, user],
      [PATH]: [500, {}],
    });
    render(
      <AuthProvider>
        <LeaderboardBoard tournamentId="t1" slug="coupe" />
      </AuthProvider>,
    );
    await screen.findByRole("alert");
    fake.set(PATH, [200, board()]);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Classement" }),
    );
  });
});
