import { Injectable } from '@nestjs/common';
import { computeBracket, type ReportedResult } from '../engine/bracket.js';
import {
  DEFAULT_SCORING,
  scorePrediction,
  type ScoringRule,
} from '../engine/predictions.js';
import {
  matchScore,
  resultWinner,
  type RoundScores,
} from '../engine/result.js';
import {
  matchKey,
  type Feeder,
  type PlannedMatch,
} from '../engine/single-elimination.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ACTIVE_REGISTRATION } from './tournament-teams.service.js';

type Tx = Prisma.TransactionClient;

// The cascade (docs/data-model.md, section 6), run in the caller's
// transaction: reads the setup and the raw results of a tournament, runs
// the engine, replaces the derived bracket rows (layer 1), then resolves
// and scores the predictions (layers 3 and 4). A result, its bracket
// advance and its points are saved together or not at all.
// Until the recompute job exists, it runs right after each raw write, so
// the bracket is up to date as soon as the request returns.
@Injectable()
export class BracketRecomputeService {
  // Serializes the writes of one tournament until the transaction ends, so
  // two results entered at once cannot both see an empty match
  async lock(tx: Tx, tournamentId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournamentId}))`;
  }

  // Rebuild from raw (data model 6.6): forgets every derived value of the
  // tournament, then computes it again from the setup and the raw results
  // only. Incremental runs after each result must end in the same state:
  // the tests compare both.
  async rebuild(tx: Tx, tournamentId: string) {
    await this.lock(tx, tournamentId);
    await tx.$executeRaw`SELECT set_config('app.recompute', 'on', true)`;
    const ofTournament = { match: { stage: { tournamentId } } };
    await tx.slotAssignment.deleteMany({ where: { matchSlot: ofTournament } });
    await tx.matchOutcome.deleteMany({ where: ofTournament });
    await tx.prediction.updateMany({
      where: ofTournament,
      data: { status: 'pending', points: 0, resolvedAt: null },
    });
    await this.recompute(tx, tournamentId);
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
            entrants: { select: { slotPosition: true, registrationId: true } },
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
    const results = new Map<string, ReportedResult>();
    const resultId = new Map<string, bigint>();
    const resultScore = new Map<string, readonly [number, number]>();
    for (const m of matches) {
      const current = m.results[0];
      if (!current || current.outcomeKind === 'void') continue;
      const rounds = current.rounds.map((round): RoundScores => [
        scoreOf(round, 1),
        scoreOf(round, 2),
      ]);
      const winner = resultWinner(rounds, current.declaredWinnerSlot);
      if (winner === null) continue;
      const entrant = (slot: number) =>
        current.entrants.find((e) => e.slotPosition === slot)?.registrationId ??
        null;
      results.set(keyOf.get(m.id)!, {
        winner,
        entrants: [entrant(1), entrant(2)],
      });
      resultId.set(keyOf.get(m.id)!, current.id);
      resultScore.set(keyOf.get(m.id)!, matchScore(rounds));
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

    // Layers 3 and 4: what each prediction is worth now
    const rule = await this.scoringRule(tx, tournamentId);
    const facts = new Map(
      matches.map((m) => {
        const key = keyOf.get(m.id)!;
        const outcome = state.outcomes.get(key)!;
        const participant = (slot: 1 | 2) =>
          state.slots.get(`${key}:${slot}`)!.participant;
        return [
          m.id,
          {
            round: m.bracketRound,
            participants: [participant(1), participant(2)] as const,
            state: outcome.state,
            winner: outcome.winner,
            score: resultScore.get(key) ?? null,
          },
        ];
      }),
    );
    await this.scorePredictions(tx, ids, facts, rule);
  }

  private async scoringRule(
    tx: Tx,
    tournamentId: string,
  ): Promise<ScoringRule> {
    const config = await tx.scoringConfig.findUnique({
      where: { tournamentId },
    });
    return config ?? DEFAULT_SCORING;
  }

  // Writes only the predictions whose outcome changed, so a run that
  // changes nothing writes nothing (data model 6.4, unchanged output)
  private async scorePredictions(
    tx: Tx,
    matchIds: string[],
    facts: Map<string, Parameters<typeof scorePrediction>[1]>,
    rule: ScoringRule,
  ) {
    const predictions = await tx.prediction.findMany({
      where: { matchId: { in: matchIds } },
      select: {
        id: true,
        matchId: true,
        pickedRegistrationId: true,
        scoreSlot1: true,
        scoreSlot2: true,
        status: true,
        points: true,
      },
    });
    const resolvedAt = new Date();
    for (const prediction of predictions) {
      const outcome = scorePrediction(
        {
          picked: prediction.pickedRegistrationId,
          score:
            prediction.scoreSlot1 === null || prediction.scoreSlot2 === null
              ? null
              : [prediction.scoreSlot1, prediction.scoreSlot2],
        },
        facts.get(prediction.matchId)!,
        rule,
      );
      if (
        outcome.status === prediction.status &&
        outcome.points === prediction.points
      ) {
        continue;
      }
      await tx.prediction.update({
        where: { id: prediction.id },
        data: {
          status: outcome.status,
          points: outcome.points,
          resolvedAt: outcome.status === 'pending' ? null : resolvedAt,
        },
      });
    }
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
