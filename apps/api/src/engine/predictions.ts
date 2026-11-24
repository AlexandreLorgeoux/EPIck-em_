import type { OutcomeView } from './bracket.js';

// Layers 3 and 4 of the cascade for match predictions: from what the
// bracket says about a match, whether a prediction is correct and what it
// is worth. Pure, like the rest of the engine.

export interface ScoringRule {
  pointsCorrectPick: number;
  exactScoreBonus: number;
  // Added for each round after the first, so later rounds are worth more
  roundIncrement: number;
}

// Same values as the column defaults of scoring_config (migration)
export const DEFAULT_SCORING: ScoringRule = {
  pointsCorrectPick: 3,
  exactScoreBonus: 2,
  roundIncrement: 1,
};

export interface PredictionPick {
  // Registration picked to win
  picked: string;
  // Optional exact score, slot 1 then slot 2
  score: readonly [number, number] | null;
}

export interface MatchFacts {
  // Column of the bracket, 1 for the first round
  round: number;
  // Who sits in slots 1 and 2 now, null while unknown
  participants: readonly [string | null, string | null];
  state: OutcomeView['state'];
  winner: string | null;
  // Score of the result that decided the match, in slot order
  score: readonly [number, number] | null;
}

export type PredictionStatus = 'pending' | 'correct' | 'wrong' | 'cancelled';

export interface PredictionOutcome {
  status: PredictionStatus;
  points: number;
}

// Points of a correct pick in a round, before the exact-score bonus
export const pointsForRound = (round: number, rule: ScoringRule) =>
  rule.pointsCorrectPick + (round - 1) * rule.roundIncrement;

export function scorePrediction(
  prediction: PredictionPick,
  match: MatchFacts,
  rule: ScoringRule,
): PredictionOutcome {
  const [first, second] = match.participants;
  // A correction moved the picked team out of this match: the prediction
  // is about a match that no longer exists, so nobody wins or loses
  // (data model 6.4)
  if (
    first !== null &&
    second !== null &&
    prediction.picked !== first &&
    prediction.picked !== second
  ) {
    return { status: 'cancelled', points: 0 };
  }
  // Pending, stale or in conflict: nothing to resolve yet
  if (match.state !== 'decided' || match.winner === null) {
    return { status: 'pending', points: 0 };
  }
  if (prediction.picked !== match.winner) {
    return { status: 'wrong', points: 0 };
  }
  const exact =
    prediction.score !== null &&
    match.score !== null &&
    prediction.score[0] === match.score[0] &&
    prediction.score[1] === match.score[1];
  return {
    status: 'correct',
    points:
      pointsForRound(match.round, rule) + (exact ? rule.exactScoreBonus : 0),
  };
}
