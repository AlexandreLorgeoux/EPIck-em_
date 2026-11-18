// Reading a match result: who won it, from its rounds. Pure, like the rest
// of the engine.

// Scores of one round, slot 1 then slot 2
export type RoundScores = readonly [number, number];

// The slot that won more rounds, or null on a tie. A single round is won
// by the higher score; a match of several rounds by the most rounds won.
export function roundsWinner(rounds: readonly RoundScores[]): 1 | 2 | null {
  const [first, second] = matchScore(rounds);
  if (first === second) return null;
  return first > second ? 1 : 2;
}

// The score shown for a match: the points of its only round, or the rounds
// won by each slot when there are several
export function matchScore(rounds: readonly RoundScores[]): [number, number] {
  if (rounds.length === 1) return [rounds[0][0], rounds[0][1]];
  let first = 0;
  let second = 0;
  for (const [a, b] of rounds) {
    if (a > b) first++;
    if (b > a) second++;
  }
  return [first, second];
}

// What layer 1 reads from the current result of a match: the winning
// slot, or a conflict when the rounds and the declared winner disagree
export function resultWinner(
  rounds: readonly RoundScores[],
  declaredWinnerSlot: number | null,
): 1 | 2 | 'conflict' | null {
  const fromRounds = roundsWinner(rounds);
  if (declaredWinnerSlot === null) return fromRounds;
  if (fromRounds !== null && fromRounds !== declaredWinnerSlot) {
    return 'conflict';
  }
  return declaredWinnerSlot === 1 || declaredWinnerSlot === 2
    ? declaredWinnerSlot
    : 'conflict';
}
