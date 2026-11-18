// Tournament engine: pure functions, no NestJS, no database. Kept apart so
// it can move to its own package (packages/engine, see ADR 0001) and be
// unit tested on its own.

// Where a slot's participant comes from
export type Feeder =
  | { kind: 'seed'; seed: number }
  // No opponent: the other slot's participant goes through
  | { kind: 'bye' }
  | { kind: 'winner'; match: string };

export interface PlannedMatch {
  // Stable within a bracket: "r2m1" is the first match of round 2
  key: string;
  // Column of the bracket, 1 is the first
  round: number;
  // Order inside the round, from 1
  position: number;
  label: string;
  slots: [Feeder, Feeder];
}

export const matchKey = (round: number, position: number) =>
  `r${round}m${position}`;

// Seed order down a bracket of `size` slots (a power of two), so the best
// seeds meet as late as possible: 8 gives 1, 8, 4, 5, 2, 7, 3, 6, read in
// pairs as 1-8, 4-5, 2-7 and 3-6
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

// The matches of a single-elimination bracket for `participants` seeds.
// Missing places up to the next power of two are byes, given to the top
// seeds, so no match ever has two byes.
export function planSingleElimination(participants: number): PlannedMatch[] {
  if (!Number.isInteger(participants) || participants < 2) {
    throw new Error('A bracket needs at least 2 participants');
  }
  const size = 2 ** Math.ceil(Math.log2(participants));
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const matches: PlannedMatch[] = [];
  let number = 1;

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 1; position <= count; position++) {
      const slots: [Feeder, Feeder] =
        round === 1
          ? [
              seedFeeder(order[2 * position - 2], participants),
              seedFeeder(order[2 * position - 1], participants),
            ]
          : [
              { kind: 'winner', match: matchKey(round - 1, 2 * position - 1) },
              { kind: 'winner', match: matchKey(round - 1, 2 * position) },
            ];
      matches.push({
        key: matchKey(round, position),
        round,
        position,
        label: `Match ${number++}`,
        slots,
      });
    }
  }
  return matches;
}

const seedFeeder = (seed: number, participants: number): Feeder =>
  seed <= participants ? { kind: 'seed', seed } : { kind: 'bye' };
