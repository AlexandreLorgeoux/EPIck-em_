import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { AuthUser } from '../auth/auth-user.js';
import { fieldException } from '../common/validation-errors.js';
import { matchScore, type RoundScores } from '../engine/result.js';
import { planSingleElimination } from '../engine/single-elimination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BracketRecomputeService } from './bracket-recompute.service.js';
import { GenerateBracketDto } from './dto/generate-bracket.dto.js';
import { ACTIVE_REGISTRATION } from './tournament-teams.service.js';
import { TournamentsService } from './tournaments.service.js';

// Fisher-Yates with a cryptographic random source: every order is equally
// likely and nobody can predict the draw
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Injectable()
export class BracketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentsService,
    private readonly recompute: BracketRecomputeService,
  ) {}

  // Builds the single-elimination bracket and starts the tournament, in
  // one transaction: either all of it is saved, or nothing
  async generate(tournamentId: string, dto: GenerateBracketDto) {
    await this.tournaments.getDraft(tournamentId, 'started');
    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, ...ACTIVE_REGISTRATION },
      select: { id: true, seed: true },
    });
    if (registrations.length < 2) {
      throw new ConflictException(
        `A bracket needs at least 2 teams: this tournament has ${registrations.length}`,
      );
    }
    const ordered =
      dto.seeding === 'auto'
        ? shuffle(registrations)
        : this.manualOrder(registrations);

    const plan = planSingleElimination(ordered.length);
    const bySeed = new Map(ordered.map((r, i) => [i + 1, r.id]));

    await this.prisma.$transaction(async (tx) => {
      for (const [seed, id] of bySeed) {
        await tx.registration.update({ where: { id }, data: { seed } });
      }
      const stage = await tx.stage.create({
        data: {
          tournamentId,
          position: 1,
          name: 'Bracket',
          format: 'single_elim',
          seedingMode: dto.seeding,
        },
      });
      const matches = await tx.match.createManyAndReturn({
        data: plan.map((m) => ({
          stageId: stage.id,
          bracketRound: m.round,
          position: m.position,
          label: m.label,
        })),
        select: { id: true, bracketRound: true, position: true },
      });
      const matchId = new Map(
        matches.map((m) => [`r${m.bracketRound}m${m.position}`, m.id]),
      );
      await tx.matchSlot.createMany({
        data: plan.flatMap((m) =>
          m.slots.map((feeder, i) => ({
            matchId: matchId.get(m.key)!,
            position: i + 1,
            feederKind:
              feeder.kind === 'winner'
                ? ('match_winner' as const)
                : feeder.kind,
            seedNumber: feeder.kind === 'seed' ? feeder.seed : null,
            feederMatchId:
              feeder.kind === 'winner' ? matchId.get(feeder.match)! : null,
          })),
        ),
      });
      // First run of layer 1: places the seeds and sends byes through
      await this.recompute.recompute(tx, tournamentId);

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { lifecycle: 'published' },
      });
    });
    return this.get(tournamentId, { id: '', role: 'admin' });
  }

  async get(tournamentId: string, user?: AuthUser) {
    // Same visibility as the tournament itself
    await this.tournaments.findOne(tournamentId, user);
    const stage = await this.prisma.stage.findFirst({
      where: { tournamentId, format: 'single_elim' },
      include: {
        matches: {
          orderBy: [{ bracketRound: 'asc' }, { position: 'asc' }],
          include: {
            outcome: {
              include: {
                result: {
                  select: {
                    rounds: {
                      orderBy: { number: 'asc' },
                      select: {
                        scores: { select: { slotPosition: true, score: true } },
                      },
                    },
                  },
                },
              },
            },
            slots: {
              orderBy: { position: 'asc' },
              include: {
                assignment: {
                  include: {
                    registration: {
                      select: {
                        seed: true,
                        team: { select: { id: true, name: true, tag: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!stage) {
      throw new NotFoundException('This tournament has no bracket yet');
    }

    const rounds = new Map<number, unknown[]>();
    for (const match of stage.matches) {
      const winner = match.outcome?.winnerRegistrationId ?? null;
      const result = match.outcome?.result;
      const score = result
        ? matchScore(
            result.rounds.map(
              (round): RoundScores =>
                [1, 2].map(
                  (slot) =>
                    round.scores.find((s) => s.slotPosition === slot)?.score ??
                    0,
                ) as [number, number],
            ),
          )
        : null;
      const list = rounds.get(match.bracketRound) ?? [];
      list.push({
        id: match.id,
        label: match.label,
        position: match.position,
        state: match.outcome?.state ?? 'pending',
        slots: match.slots.map((slot) => {
          const registration = slot.assignment?.registration;
          return {
            position: slot.position,
            state: slot.assignment?.state ?? 'open',
            seed: registration?.seed ?? null,
            team: registration?.team ?? null,
            score: score ? score[slot.position - 1] : null,
            winner: Boolean(
              winner && slot.assignment?.registrationId === winner,
            ),
          };
        }),
      });
      rounds.set(match.bracketRound, list);
    }
    return {
      stage: {
        id: stage.id,
        name: stage.name,
        format: stage.format,
        seeding: stage.seedingMode,
      },
      rounds: [...rounds].map(([round, matches]) => ({ round, matches })),
    };
  }

  // Manual seeding needs seeds 1 to n, each once
  private manualOrder(registrations: { id: string; seed: number | null }[]) {
    const seeds = registrations.map((r) => r.seed);
    const complete =
      seeds.every((s) => s !== null) &&
      new Set(seeds).size === seeds.length &&
      seeds.every((s) => s! >= 1 && s! <= seeds.length);
    if (!complete) {
      throw fieldException(
        'seeding',
        `Every team needs a different seed from 1 to ${registrations.length}: set them with PUT /tournaments/:id/seeding, or choose auto`,
      );
    }
    return [...registrations].sort((a, b) => a.seed! - b.seed!);
  }
}
