import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { fieldException } from '../common/validation-errors.js';
import { roundsWinner } from '../engine/result.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BracketRecomputeService } from './bracket-recompute.service.js';
import { BracketService } from './bracket.service.js';
import { RecordResultDto } from './dto/record-result.dto.js';

@Injectable()
export class MatchResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recompute: BracketRecomputeService,
    private readonly bracket: BracketService,
  ) {}

  // Saves the raw result and moves the winner forward, in one transaction.
  // A match that already has a result gets a new version with a reason:
  // the earlier ones stay, append-only. Returns the updated bracket.
  async record(matchId: string, dto: RecordResultDto, user: AuthUser) {
    const [first, second] = dto.scores;
    const winner = roundsWinner([[first, second]]);
    if (winner === null) {
      throw fieldException(
        'scores',
        'A match cannot end in a tie: enter the score that decided it',
      );
    }
    if (winner !== dto.winnerSlot) {
      throw fieldException(
        'winnerSlot',
        'winnerSlot must be the slot with the higher score',
      );
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { stage: { select: { tournamentId: true } } },
    });
    if (!match) throw new NotFoundException(`No match ${matchId}`);
    const { tournamentId } = match.stage;

    await this.prisma.$transaction(async (tx) => {
      // Read under the lock, so the checks still hold when the result is saved
      await this.recompute.lock(tx, tournamentId);
      const current = await tx.match.findUniqueOrThrow({
        where: { id: matchId },
        select: {
          label: true,
          results: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { id: true, version: true },
          },
          slots: {
            orderBy: { position: 'asc' },
            select: { position: true, assignment: true },
          },
        },
      });
      const assignments = current.slots.map((s) => s.assignment);
      if (assignments.some((a) => a?.state === 'bye')) {
        throw new ConflictException(
          `${current.label} has a bye: there is no result to enter`,
        );
      }
      const previous = current.results[0];
      if (previous && !dto.reason) {
        throw fieldException(
          'reason',
          `reason is required to correct ${current.label}: say why the result changes`,
        );
      }
      if (assignments.some((a) => a?.state !== 'assigned')) {
        throw new ConflictException(
          `${current.label} cannot be played yet: both teams are not known`,
        );
      }

      // The reported teams are stored with the result (section 6.4), with
      // the score as one round: per-game scores come with the match page
      await tx.matchResult.create({
        data: {
          matchId,
          version: (previous?.version ?? 0) + 1,
          supersedesId: previous?.id,
          reason: dto.reason,
          outcomeKind: 'played',
          declaredWinnerSlot: dto.winnerSlot,
          reportedById: user.id,
          entrants: {
            create: current.slots.map((slot) => ({
              slotPosition: slot.position,
              registrationId: slot.assignment!.registrationId!,
            })),
          },
          rounds: {
            create: {
              number: 1,
              scores: {
                create: [
                  { slotPosition: 1, score: first },
                  { slotPosition: 2, score: second },
                ],
              },
            },
          },
        },
      });
      await this.recompute.recompute(tx, tournamentId);
    });
    return this.bracket.get(tournamentId, user);
  }
}
