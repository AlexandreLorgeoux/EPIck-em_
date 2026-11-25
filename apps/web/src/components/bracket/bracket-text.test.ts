import { describe, expect, it } from "@jest/globals";
import type { Bracket, BracketMatch, BracketSlot } from "@/lib/api/models";
import {
  announceChanges,
  announceResult,
  championOf,
  matchStatus,
  roundName,
  feederMatch,
  nextText,
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

describe("the path of the bracket", () => {
  // 8 teams: matches 1 to 4, then 5 and 6, then the final
  const label = (round: number, position: number) =>
    `Match ${[0, 4, 6][round - 1] + position}`;
  const paths: Bracket = {
    stage: {
      id: "s1",
      name: "Bracket",
      format: "single_elim",
      seeding: "auto",
    },
    rounds: [4, 2, 1].map((count, i) => ({
      round: i + 1,
      matches: Array.from({ length: count }, (_, p) => ({
        id: `r${i + 1}m${p + 1}`,
        label: label(i + 1, p + 1),
        position: p + 1,
        state: "pending",
        hasResult: false,
        predictionLock: null,
        slots: [],
      })),
    })),
  };

  it("says where the winner of each match goes", () => {
    const next = paths.rounds.flatMap(({ round, matches }) =>
      matches.map((m) => nextText(paths, round, m.position)),
    );
    expect(next).toEqual([
      "Le vainqueur joue Match 5",
      "Le vainqueur joue Match 5",
      "Le vainqueur joue Match 6",
      "Le vainqueur joue Match 6",
      "Le vainqueur joue Match 7",
      "Le vainqueur joue Match 7",
      "Le vainqueur remporte le tournoi",
    ]);
  });

  it("says which match gives each slot its team", () => {
    const from = (round: number, position: number) =>
      [1, 2].map((s) => feederMatch(paths, round, position, s)?.label);
    expect(from(1, 1)).toEqual([undefined, undefined]);
    expect(from(2, 1)).toEqual(["Match 1", "Match 2"]);
    expect(from(2, 2)).toEqual(["Match 3", "Match 4"]);
    expect(from(3, 1)).toEqual(["Match 5", "Match 6"]);
  });
});

describe("announceChanges", () => {
  const played = (label: string, position: number, done: boolean) => ({
    ...match(
      label,
      [
        slot("Alpha", { winner: done, score: done ? 2 : null }),
        slot("Bravo", { position: 2, score: done ? 0 : null }),
      ],
      done ? { state: "decided", hasResult: true } : {},
    ),
    id: label,
    position,
  });
  const state = (first: boolean, second: boolean): Bracket => ({
    stage: {
      id: "s1",
      name: "Bracket",
      format: "single_elim",
      seeding: "auto",
    },
    rounds: [
      {
        round: 1,
        matches: [played("Match 1", 1, first), played("Match 2", 2, second)],
      },
      { round: 2, matches: [played("Match 3", 1, false)] },
    ],
  });

  it("says one result, sums up several, and is silent without any", () => {
    expect(announceChanges(state(false, false), state(true, false))).toBe(
      "Alpha gagne Match 1 et passe en finale.",
    );
    expect(announceChanges(state(false, false), state(true, true))).toBe(
      "2 résultats mis à jour : Match 1, Match 2.",
    );
    expect(announceChanges(state(true, true), state(true, true))).toBe("");
  });
});
