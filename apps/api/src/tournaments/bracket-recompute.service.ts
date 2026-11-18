import { Injectable } from '@nestjs/common';
import { computeBracket } from '../engine/bracket.js';
import { resultWinner, type RoundScores } from '../engine/result.js';
import {
  matchKey,
  type Feeder,
  type PlannedMatch,
} from '../engine/single-elimination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ACTIVE_REGISTRATION } from './tournament-teams.service.js';

type Tx = Prisma.TransactionClient;

// Layer 1 of the cascade (docs/data-model.md, section 6), run in the
// caller's transaction: reads the setup and the raw results of a
// tournament, runs the engine and replaces the derived bracket rows.
// Until the recompute job exists, it runs right after each raw write, so
// the bracket is up to date as soon as the request returns.
@Injectable()
export class BracketRecomputeService {
  // Serializes the writes of one tournament until the transaction ends, so
  // two results entered at once cannot both see an empty match
  async lock(tx: Tx, tournamentId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}))`;
  }

  async recompute(tx: Tx, tournamentId: string) {
    await this.lock(tx, tournamentId);
    const matches = await tx.match.findMany({
      where: { stage: { tournamentId, format: 'single_elim' } },
      select: {
        id: true,
        bracketRound: true,
        position: true,
        label: true,
        slots: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            feederKind: true,
            seedNumber: true,
            feederMatchId: true,
          },
        },
        // The current result is the highest version
        results: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            outcomeKind: true,
            declaredWinnerSlot: true,
            rounds: {
              orderBy: { number: 'asc' },
              select: {
                scores: { select: { slotPosition: true, score: true } },
              },
            },
          },
        },
      },
    });
    if (!matches.length) return;

    const keyOf = new Map(
      matches.map((m) => [m.id, matchKey(m.bracketRound, m.position)]),
    );
    const plan: PlannedMatch[] = matches.map((m) => ({
      key: keyOf.get(m.id)!,
      round: m.bracketRound,
      position: m.position,
      label: m.label,
      slots: m.slots.map((slot) => toFeeder(slot, keyOf)) as [Feeder, Feeder],
    }));

    const registrations = await tx.registration.findMany({
      where: { tournamentId, seed: { not: null }, ...ACTIVE_REGISTRATION },
      select: { id: true, seed: true },
    });
    const seeds = new Map(registrations.map((r) => [r.seed!, r.id]));

    // A void result sends the match back to pending: it is left out
    const results = new Map<string, 1 | 2 | 'conflict'>();
    const resultId = new Map<string, bigint>();
    for (const m of matches) {
      const current = m.results[0];
      if (!current || current.outcomeKind === 'void') continue;
      const rounds = current.rounds.map((round): RoundScores => [
        scoreOf(round, 1),
        scoreOf(round, 2),
      ]);
      const winner = resultWinner(rounds, current.declaredWinnerSlot);
      if (winner === null) continue;
      results.set(keyOf.get(m.id)!, winner);
      resultId.set(keyOf.get(m.id)!, current.id);
    }

    const state = computeBracket(plan, seeds, results);

    // Replace, don't append (section 6.3): the full set of rows is written
    // again, so the stored state is always what the engine computes
    await tx.$executeRaw`SELECT set_config('app.recompute', 'on', true)`;
    const ids = matches.map((m) => m.id);
    await tx.slotAssignment.deleteMany({
      where: { matchSlot: { matchId: { in: ids } } },
    });
    await tx.matchOutcome.deleteMany({ where: { matchId: { in: ids } } });
    await tx.slotAssignment.createMany({
      data: matches.flatMap((m) =>
        m.slots.map((slot, i) => {
          const view = state.slots.get(`${keyOf.get(m.id)}:${i + 1}`)!;
          return {
            matchSlotId: slot.id,
            registrationId: view.participant,
            state: view.state,
            resolvedFrom: view.resolvedFrom,
          };
        }),
      ),
    });
    await tx.matchOutcome.createMany({
      data: matches.map((m) => {
        const key = keyOf.get(m.id)!;
        const outcome = state.outcomes.get(key)!;
        return {
          matchId: m.id,
          state: outcome.state,
          // Only a match decided by its result points to it, not a bye
          resultId:
            outcome.state === 'pending' ? null : (resultId.get(key) ?? null),
          winnerRegistrationId: outcome.winner,
          loserRegistrationId: outcome.loser,
        };
      }),
    });
  }
}

function toFeeder(
  slot: {
    feederKind: string;
    seedNumber: number | null;
    feederMatchId: string | null;
  },
  keyOf: Map<string, string>,
): Feeder {
  switch (slot.feederKind) {
    case 'seed':
      return { kind: 'seed', seed: slot.seedNumber! };
    case 'bye':
      return { kind: 'bye' };
    case 'match_winner':
      return { kind: 'winner', match: keyOf.get(slot.feederMatchId!)! };
    default:
      throw new Error(`Feeder ${slot.feederKind} is not supported yet`);
  }
}

const scoreOf = (
  round: { scores: { slotPosition: number; score: number }[] },
  slot: number,
) => round.scores.find((s) => s.slotPosition === slot)?.score ?? 0;
