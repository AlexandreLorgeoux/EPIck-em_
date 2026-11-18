import type { PlannedMatch } from './single-elimination.js';

// Layer 1 of the cascade (docs/data-model.md, section 6): from the bracket
// plan, the seeds and the winners decided so far, who sits in every slot
// and how every match stands. Pure: same input, same output.

export type SlotState = 'open' | 'assigned' | 'bye';

export interface SlotView {
  participant: string | null;
  state: SlotState;
  resolvedFrom: 'seed' | 'feeder' | 'bye' | 'none';
}

export interface OutcomeView {
  state: 'pending' | 'decided';
  winner: string | null;
  loser: string | null;
}

export interface BracketState {
  // Keyed "matchKey:slot", slot being 1 or 2
  slots: Map<string, SlotView>;
  outcomes: Map<string, OutcomeView>;
}

export const slotKey = (match: string, slot: 1 | 2) => `${match}:${slot}`;

export function computeBracket(
  plan: PlannedMatch[],
  // Participant of each seed
  seeds: ReadonlyMap<number, string>,
  // Winning slot of each played match
  winners: ReadonlyMap<string, 1 | 2> = new Map(),
): BracketState {
  const slots = new Map<string, SlotView>();
  const outcomes = new Map<string, OutcomeView>();
  const ordered = [...plan].sort(
    (a, b) => a.round - b.round || a.position - b.position,
  );

  // Rounds in order, so every feeder match is settled before it is read
  for (const match of ordered) {
    const views = match.slots.map((feeder): SlotView => {
      if (feeder.kind === 'bye') {
        return { participant: null, state: 'bye', resolvedFrom: 'bye' };
      }
      if (feeder.kind === 'seed') {
        const participant = seeds.get(feeder.seed) ?? null;
        return participant
          ? { participant, state: 'assigned', resolvedFrom: 'seed' }
          : { participant: null, state: 'open', resolvedFrom: 'none' };
      }
      const winner = outcomes.get(feeder.match)?.winner ?? null;
      return winner
        ? { participant: winner, state: 'assigned', resolvedFrom: 'feeder' }
        : { participant: null, state: 'open', resolvedFrom: 'none' };
    }) as [SlotView, SlotView];

    views.forEach((view, i) =>
      slots.set(slotKey(match.key, (i + 1) as 1 | 2), view),
    );
    outcomes.set(match.key, decide(views, winners.get(match.key)));
  }
  return { slots, outcomes };
}

function decide(
  [first, second]: [SlotView, SlotView],
  winningSlot: 1 | 2 | undefined,
): OutcomeView {
  // A bye: the participant facing nobody goes through without playing
  if (first.state === 'bye' || second.state === 'bye') {
    const through = first.state === 'assigned' ? first : second;
    return through.state === 'assigned'
      ? { state: 'decided', winner: through.participant, loser: null }
      : { state: 'pending', winner: null, loser: null };
  }
  if (
    winningSlot &&
    first.state === 'assigned' &&
    second.state === 'assigned'
  ) {
    const [winner, loser] =
      winningSlot === 1 ? [first, second] : [second, first];
    return {
      state: 'decided',
      winner: winner.participant,
      loser: loser.participant,
    };
  }
  return { state: 'pending', winner: null, loser: null };
}
