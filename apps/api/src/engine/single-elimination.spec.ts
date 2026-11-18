import { describe, expect, it } from '@jest/globals';
import {
  planSingleElimination,
  seedOrder,
  type PlannedMatch,
} from './single-elimination.js';

const round1Pairs = (plan: PlannedMatch[]) =>
  plan
    .filter((m) => m.round === 1)
    .map((m) => m.slots.map((s) => (s.kind === 'seed' ? s.seed : 'bye')));

describe('seedOrder', () => {
  it.each([
    [2, [1, 2]],
    [4, [1, 4, 2, 3]],
    [8, [1, 8, 4, 5, 2, 7, 3, 6]],
  ])('places %i seeds so the best meet last', (size, order) => {
    expect(seedOrder(size)).toEqual(order);
  });

  it('uses every seed exactly once', () => {
    const order = seedOrder(32);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 32 }, (_, i) => i + 1),
    );
  });
});

describe('planSingleElimination', () => {
  it('pairs 8 seeds 1-8, 4-5, 2-7, 3-6', () => {
    expect(round1Pairs(planSingleElimination(8))).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });

  it.each([
    [2, 1, 1],
    [3, 3, 2],
    [5, 7, 3],
    [6, 7, 3],
    [8, 7, 3],
    [16, 15, 4],
    [17, 31, 5],
  ])('builds %i seeds into %i matches over %i rounds', (n, matches, rounds) => {
    const plan = planSingleElimination(n);
    expect(plan).toHaveLength(matches);
    expect(Math.max(...plan.map((m) => m.round))).toBe(rounds);
  });

  it('gives the byes to the top seeds, never two in one match', () => {
    // 6 participants in 8 places: seeds 1 and 2 get the byes
    const pairs = round1Pairs(planSingleElimination(6));
    expect(pairs).toEqual([
      [1, 'bye'],
      [4, 5],
      [2, 'bye'],
      [3, 6],
    ]);
    for (const n of [3, 5, 6, 7, 9, 13, 17, 31]) {
      for (const pair of round1Pairs(planSingleElimination(n))) {
        expect(pair).not.toEqual(['bye', 'bye']);
      }
    }
  });

  it('feeds each later match from two matches of the round before', () => {
    const plan = planSingleElimination(8);
    const semi = plan.find((m) => m.key === 'r2m2');
    expect(semi?.slots).toEqual([
      { kind: 'winner', match: 'r1m3' },
      { kind: 'winner', match: 'r1m4' },
    ]);
    const final = plan.find((m) => m.round === 3);
    expect(final).toMatchObject({ key: 'r3m1', label: 'Match 7' });
  });

  it('numbers matches across the bracket', () => {
    expect(planSingleElimination(4).map((m) => m.label)).toEqual([
      'Match 1',
      'Match 2',
      'Match 3',
    ]);
  });

  it.each([0, 1, 2.5, -3])('refuses %p participants', (n) => {
    expect(() => planSingleElimination(n)).toThrow(
      'A bracket needs at least 2 participants',
    );
  });
});
