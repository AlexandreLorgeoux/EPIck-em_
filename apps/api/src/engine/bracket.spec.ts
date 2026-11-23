import { describe, expect, it } from '@jest/globals';
import { computeBracket, slotKey, type ReportedResult } from './bracket.js';
import { planSingleElimination } from './single-elimination.js';

// Results keyed by match, winning slot only: teams not checked
const won = (entries: [string, ReportedResult['winner']][]) =>
  new Map(entries.map(([match, winner]) => [match, { winner }]));

// Seed n is played by team "Tn"
const seeds = (n: number) =>
  new Map(Array.from({ length: n }, (_, i) => [i + 1, `T${i + 1}`]));

describe('computeBracket', () => {
  it('places every seed in its first-round slot', () => {
    const { slots, outcomes } = computeBracket(
      planSingleElimination(4),
      seeds(4),
    );
    expect(slots.get(slotKey('r1m1', 1))).toEqual({
      participant: 'T1',
      state: 'assigned',
      resolvedFrom: 'seed',
    });
    expect(slots.get(slotKey('r1m1', 2))?.participant).toBe('T4');
    expect(outcomes.get('r1m1')).toEqual({
      state: 'pending',
      winner: null,
      loser: null,
    });
  });

  it('leaves later rounds open until their feeder matches are decided', () => {
    const { slots, outcomes } = computeBracket(
      planSingleElimination(4),
      seeds(4),
    );
    expect(slots.get(slotKey('r2m1', 1))).toEqual({
      participant: null,
      state: 'open',
      resolvedFrom: 'none',
    });
    expect(outcomes.get('r2m1')?.state).toBe('pending');
  });

  it('sends a team facing a bye straight to the next round', () => {
    // 3 teams: seed 1 has a bye, seeds 2 and 3 play
    const { slots, outcomes } = computeBracket(
      planSingleElimination(3),
      seeds(3),
    );
    expect(slots.get(slotKey('r1m1', 2))).toEqual({
      participant: null,
      state: 'bye',
      resolvedFrom: 'bye',
    });
    expect(outcomes.get('r1m1')).toEqual({
      state: 'decided',
      winner: 'T1',
      loser: null,
    });
    expect(slots.get(slotKey('r2m1', 1))).toEqual({
      participant: 'T1',
      state: 'assigned',
      resolvedFrom: 'feeder',
    });
    expect(slots.get(slotKey('r2m1', 2))?.state).toBe('open');
  });

  it('moves winners forward through the bracket', () => {
    const plan = planSingleElimination(4);
    const { slots, outcomes } = computeBracket(
      plan,
      seeds(4),
      won([
        ['r1m1', 2], // T4 beats T1
        ['r1m2', 1], // T2 beats T3
        ['r2m1', 1], // T4 beats T2 in the final
      ]),
    );
    expect(outcomes.get('r1m1')).toEqual({
      state: 'decided',
      winner: 'T4',
      loser: 'T1',
    });
    expect(slots.get(slotKey('r2m1', 1))?.participant).toBe('T4');
    expect(slots.get(slotKey('r2m1', 2))?.participant).toBe('T2');
    expect(outcomes.get('r2m1')).toEqual({
      state: 'decided',
      winner: 'T4',
      loser: 'T2',
    });
  });

  it('ignores a winner for a match whose players are not both known yet', () => {
    const { outcomes } = computeBracket(
      planSingleElimination(4),
      seeds(4),
      won([['r2m1', 1]]),
    );
    expect(outcomes.get('r2m1')?.state).toBe('pending');
  });

  it('stops a conflicting result from moving anyone forward', () => {
    const { slots, outcomes } = computeBracket(
      planSingleElimination(4),
      seeds(4),
      won([['r1m1', 'conflict']]),
    );
    expect(outcomes.get('r1m1')).toEqual({
      state: 'conflict',
      winner: null,
      loser: null,
    });
    expect(slots.get(slotKey('r2m1', 1))?.state).toBe('open');
  });

  it('marks a result stale when its teams no longer play the match', () => {
    // The final was reported as T1 against T2, then the first semi-final
    // was corrected: T4 now sits in slot 1
    const { outcomes, slots } = computeBracket(
      planSingleElimination(4),
      seeds(4),
      new Map<string, ReportedResult>([
        ['r1m1', { winner: 2, entrants: ['T1', 'T4'] }],
        ['r1m2', { winner: 1, entrants: ['T2', 'T3'] }],
        ['r2m1', { winner: 1, entrants: ['T1', 'T2'] }],
      ]),
    );
    expect(slots.get(slotKey('r2m1', 1))?.participant).toBe('T4');
    expect(outcomes.get('r2m1')).toEqual({
      state: 'stale',
      winner: null,
      loser: null,
    });
  });

  it('decides a result whose teams match the slots', () => {
    const { outcomes } = computeBracket(
      planSingleElimination(2),
      seeds(2),
      new Map<string, ReportedResult>([
        ['r1m1', { winner: 2, entrants: ['T1', 'T2'] }],
      ]),
    );
    expect(outcomes.get('r1m1')).toEqual({
      state: 'decided',
      winner: 'T2',
      loser: 'T1',
    });
  });

  it('gives the same result for the same input, whatever the plan order', () => {
    const plan = planSingleElimination(6);
    const winners = won([['r1m2', 1]]);
    const a = computeBracket(plan, seeds(6), winners);
    const b = computeBracket([...plan].reverse(), seeds(6), winners);
    expect([...b.slots]).toEqual([...a.slots]);
    expect([...b.outcomes]).toEqual([...a.outcomes]);
  });
});
