import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { DEFAULT_SCORING, type ScoringRule } from '../engine/predictions.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BracketRecomputeService } from './bracket-recompute.service.js';
import { SetScoringDto } from './dto/set-scoring.dto.js';
import { TournamentsService } from './tournaments.service.js';

const ADMIN_VIEW: AuthUser = { id: '', role: 'admin' };

const ruleOf = (rule: ScoringRule): ScoringRule => ({
  pointsCorrectPick: rule.pointsCorrectPick,
  exactScoreBonus: rule.exactScoreBonus,
  roundIncrement: rule.roundIncrement,
});

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentsService,
    private readonly recompute: BracketRecomputeService,
  ) {}

  // The points of the tournament; the defaults until an admin sets them
  async get(tournamentId: string, user?: AuthUser) {
    // Same visibility as the tournament itself
    const tournament = await this.tournaments.findOne(tournamentId, user);
    const config = await this.prisma.scoringConfig.findUnique({
      where: { tournamentId: tournament.id },
    });
    return {
      ...ruleOf(config ?? DEFAULT_SCORING),
      isDefault: !config,
      updatedAt: config?.updatedAt ?? null,
    };
  }

  // Saves the new points, logs the change and scores every prediction
  // again with them, in one transaction (data model 6.6: a scoring change
  // is a full recalculation)
  async set(tournamentId: string, dto: SetScoringDto, user: AuthUser) {
    const tournament = await this.tournaments.findOne(tournamentId, ADMIN_VIEW);
    const rule = ruleOf(dto);
    await this.prisma.$transaction(async (tx) => {
      await this.recompute.lock(tx, tournament.id);
      const previous = await tx.scoringConfig.findUnique({
        where: { tournamentId: tournament.id },
      });
      await tx.scoringConfig.upsert({
        where: { tournamentId: tournament.id },
        create: { tournamentId: tournament.id, ...rule, updatedById: user.id },
        update: { ...rule, updatedById: user.id },
      });
      await tx.scoreAuditLog.create({
        data: {
          tournamentId: tournament.id,
          actorUserId: user.id,
          action: 'scoring_changed',
          oldValue: {
            ...ruleOf(previous ?? DEFAULT_SCORING),
            isDefault: !previous,
          },
          newValue: { ...rule },
        },
      });
      await this.recompute.recompute(tx, tournament.id);
    });
    return this.get(tournament.id, ADMIN_VIEW);
  }
}
