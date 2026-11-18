import { describe, expect, it } from '@jest/globals';
import { matchScore, resultWinner, roundsWinner } from './result.js';

describe('matchScore', () => {
  it('shows the points of a match played in one round', () => {
    expect(matchScore([[3, 1]])).toEqual([3, 1]);
  });

  it('counts the rounds won when there are several', () => {
    expect(
      matchScore([
        [16, 12],
        [9, 16],
        [16, 4],
      ]),
    ).toEqual([2, 1]);
  });

  it('gives 0-0 without rounds', () => {
    expect(matchScore([])).toEqual([0, 0]);
  });
});

describe('roundsWinner', () => {
  it.each([
    [[[3, 1]], 1],
    [[[0, 2]], 2],
    [
      [
        [1, 2],
        [2, 1],
        [0, 5],
      ],
      2,
    ],
  ] as const)('reads %j as a win for slot %d', (rounds, slot) => {
    expect(roundsWinner(rounds)).toBe(slot);
  });

  it('finds no winner in a tie', () => {
    expect(roundsWinner([[2, 2]])).toBeNull();
    expect(roundsWinner([])).toBeNull();
  });
});

describe('resultWinner', () => {
  it('agrees with a declared winner that matches the rounds', () => {
    expect(resultWinner([[3, 1]], 1)).toBe(1);
  });

  it('flags a declared winner that contradicts the rounds', () => {
    expect(resultWinner([[3, 1]], 2)).toBe('conflict');
  });

  it('takes the declared winner when the rounds do not decide, as for a forfeit', () => {
    expect(resultWinner([], 2)).toBe(2);
  });

  it('reads the rounds when no winner is declared', () => {
    expect(resultWinner([[0, 1]], null)).toBe(2);
    expect(resultWinner([[1, 1]], null)).toBeNull();
  });

  it('flags a declared slot that does not exist', () => {
    expect(resultWinner([], 3)).toBe('conflict');
  });
});
