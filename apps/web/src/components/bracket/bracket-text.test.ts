import { describe, expect, it } from "@jest/globals";
import type { Bracket, BracketMatch, BracketSlot } from "@/lib/api/models";
import {
  announceResult,
  championOf,
  matchStatus,
  roundName,
} from "./bracket-text";

const slot = (
  name: string | null,
  extra: Partial<BracketSlot> = {},
): BracketSlot => ({
  position: 1,
  state: name ? "assigned" : "open",
  seed: null,
  team: name ? { id: name, name, tag: null } : null,
  score: null,
  winner: false,
  ...extra,
});

const match = (
  label: string,
  slots: BracketSlot[],
  extra: Partial<BracketMatch> = {},
): BracketMatch => ({
  id: label,
  label,
  position: 1,
  state: "pending",
  hasResult: false,
  predictionLock: null,
  slots,
  ...extra,
});

// Four teams: two semi-finals, then the final
const bracket = (semi: BracketMatch, final: BracketMatch): Bracket => ({
  stage: { id: "s", name: "Bracket", format: "single_elim", seeding: "auto" },
  rounds: [
    {
      round: 1,
      matches: [semi, match("Match 2", [slot("Bravo"), slot("Charlie")])],
    },
    { round: 2, matches: [final] },
  ],
});

describe("roundName", () => {
  it.each([
    [3, 3, "Finale"],
    [2, 3, "Demi-finales"],
    [2, 4, "Quarts de finale"],
    [1, 5, "Tour 1"],
  ])("names round %i of %i %p", (round, rounds, name) => {
    expect(roundName(round, rounds)).toBe(name);
  });
});

describe("matchStatus", () => {
  it("says in words what a match waits for", () => {
    expect(matchStatus(match("M", [slot("A"), slot("B")]))).toBe("À jouer");
    expect(matchStatus(match("M", [slot("A"), slot(null)]))).toBe(
      "En attente des équipes",
    );
    expect(
      matchStatus(match("M", [slot("A"), slot(null, { state: "bye" })])),
    ).toBe("Sans adversaire");
    expect(
      matchStatus(match("M", [slot("A"), slot("B")], { state: "stale" })),
    ).toBe("À corriger : les équipes ont changé");
  });
});

describe("announceResult", () => {
  const won = match(
    "Match 1",
    [slot("Alpha", { winner: true }), slot("Delta")],
    { state: "decided", hasResult: true },
  );

  it("says where the winner goes", () => {
    const final = match("Match 3", [slot("Alpha"), slot(null)]);
    expect(announceResult(bracket(won, final), "Match 1")).toBe(
      "Alpha gagne Match 1 et passe en finale.",
    );
  });

  it("names the winner of the tournament after the final", () => {
    const final = match(
      "Match 3",
      [slot("Alpha"), slot("Bravo", { winner: true })],
      { state: "decided", hasResult: true },
    );
    expect(announceResult(bracket(won, final), "Match 3")).toBe(
      "Bravo gagne la finale et remporte le tournoi.",
    );
  });

  it("adds, in the same sentence, the match a correction made stale", () => {
    const final = match("Match 3", [slot("Alpha"), slot("Bravo")], {
      state: "stale",
      hasResult: true,
    });
    expect(announceResult(bracket(won, final), "Match 1")).toBe(
      "Alpha gagne Match 1 et passe en finale. Match 3 est à corriger : ses équipes ont changé.",
    );
  });
});

describe("championOf", () => {
  it("names the winner of the final, and nobody before it is played", () => {
    const won = match(
      "Match 1",
      [slot("Alpha", { winner: true }), slot("Delta")],
      {
        state: "decided",
      },
    );
    const open = match("Match 3", [slot("Alpha"), slot(null)]);
    expect(championOf(bracket(won, open))).toBeNull();
    const final = match(
      "Match 3",
      [slot("Alpha"), slot("Bravo", { winner: true })],
      {
        state: "decided",
      },
    );
    expect(championOf(bracket(won, final))).toBe("Bravo");
  });
});
