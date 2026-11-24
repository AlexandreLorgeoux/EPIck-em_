import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_SCORING,
  pointsForRound,
  scorePrediction,
  type MatchFacts,
} from './predictions.js';

// Alpha beat Bravo 3-1 in the first round
const decided: MatchFacts = {
  round: 1,
  participants: ['alpha', 'bravo'],
  state: 'decided',
  winner: 'alpha',
  score: [3, 1],
};

describe('scorePrediction', () => {
  it('awards the points of the round for the right winner', () => {
    expect(
      scorePrediction(
        { picked: 'alpha', score: null },
        decided,
        DEFAULT_SCORING,
      ),
    ).toEqual({ status: 'correct', points: 3 });
  });

  it('adds the bonus for the exact score too', () => {
    expect(
      scorePrediction(
        { picked: 'alpha', score: [3, 1] },
        decided,
        DEFAULT_SCORING,
      ),
    ).toEqual({ status: 'correct', points: 5 });
    // Right winner, wrong score: no bonus
    expect(
      scorePrediction(
        { picked: 'alpha', score: [2, 0] },
        decided,
        DEFAULT_SCORING,
      ),
    ).toEqual({ status: 'correct', points: 3 });
  });

  it('gives nothing for the wrong winner, exact score or not', () => {
    expect(
      scorePrediction(
        { picked: 'bravo', score: [1, 3] },
        decided,
        DEFAULT_SCORING,
      ),
    ).toEqual({ status: 'wrong', points: 0 });
  });

  it('leaves a match without a result unresolved', () => {
    for (const state of ['pending', 'stale', 'conflict'] as const) {
      expect(
        scorePrediction(
          { picked: 'alpha', score: null },
          { ...decided, state, winner: null, score: null },
          DEFAULT_SCORING,
        ),
      ).toEqual({ status: 'pending', points: 0 });
    }
  });

  it('cancels a prediction whose team no longer plays the match', () => {
    expect(
      scorePrediction(
        { picked: 'charlie', score: null },
        decided,
        DEFAULT_SCORING,
      ),
    ).toEqual({ status: 'cancelled', points: 0 });
  });

  it('keeps a prediction pending while the other team is not known', () => {
    expect(
      scorePrediction(
        { picked: 'charlie', score: null },
        {
          ...decided,
          participants: ['alpha', null],
          state: 'pending',
          winner: null,
        },
        DEFAULT_SCORING,
      ),
    ).toEqual({ status: 'pending', points: 0 });
  });

  it('makes later rounds worth more', () => {
    const rule = {
      pointsCorrectPick: 3,
      exactScoreBonus: 2,
      roundIncrement: 2,
    };
    expect(pointsForRound(1, rule)).toBe(3);
    expect(pointsForRound(3, rule)).toBe(7);
    expect(
      scorePrediction(
        { picked: 'alpha', score: [3, 1] },
        { ...decided, round: 3 },
        rule,
      ),
    ).toEqual({ status: 'correct', points: 9 });
  });
});
