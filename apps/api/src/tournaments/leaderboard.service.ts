import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LeaderboardQuery } from './dto/leaderboard.query.js';
import { TournamentEventsService } from './tournament-events.service.js';
import { TournamentsService } from './tournaments.service.js';

interface RankedRow {
  user_id: string;
  display_name: string;
  rank: number;
  points: number;
  correct_picks: number;
  predictions: number;
}

const toEntry = (row: RankedRow) => ({
  rank: row.rank,
  user: { id: row.user_id, displayName: row.display_name },
  points: row.points,
  correctPicks: row.correct_picks,
  predictions: row.predictions,
});

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentsService,
    private readonly events: TournamentEventsService,
  ) {}

  /**
   * Everyone who predicted in the tournament, ranked by points, then by
   * correct picks, then by who submitted first; the user id ends any tie,
   * so the order is total and stable (data model 6.3). With `me`, the
   * signed-in user's own row, wherever it is.
   */
  async get(tournamentId: string, query: LeaderboardQuery, user?: AuthUser) {
    // Same visibility as the tournament itself
    const tournament = await this.tournaments.findOne(tournamentId, user);
    const ranked = (where: Prisma.Sql, page: Prisma.Sql) =>
      this.prisma.$queryRaw<RankedRow[]>`
        WITH ranked AS (
          SELECT p.user_id,
                 u.display_name,
                 (ROW_NUMBER() OVER (
                   ORDER BY SUM(p.points) DESC,
                            COUNT(*) FILTER (WHERE p.status = 'correct') DESC,
                            MIN(p.created_at) ASC,
                            p.user_id ASC
                 ))::int AS rank,
                 SUM(p.points)::int AS points,
                 (COUNT(*) FILTER (WHERE p.status = 'correct'))::int AS correct_picks,
                 COUNT(*)::int AS predictions
          FROM prediction p
          JOIN match m ON m.id = p.match_id
          JOIN stage s ON s.id = m.stage_id
          JOIN "user" u ON u.id = p.user_id
          WHERE s.tournament_id = ${tournament.id}::uuid
          GROUP BY p.user_id, u.display_name
        )
        SELECT * FROM ranked ${where} ORDER BY rank ${page}`;

    const [entries, total, me, version] = await Promise.all([
      ranked(
        Prisma.empty,
        Prisma.sql`LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      ),
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(DISTINCT p.user_id)::int AS total
        FROM prediction p
        JOIN match m ON m.id = p.match_id
        JOIN stage s ON s.id = m.stage_id
        WHERE s.tournament_id = ${tournament.id}::uuid`,
      user
        ? ranked(Prisma.sql`WHERE user_id = ${user.id}::uuid`, Prisma.empty)
        : Promise.resolve([]),
      this.events.version(tournament.id),
    ]);
    return {
      // The same version as the live events: a client compares them
      version: version.toString(),
      page: query.page,
      pageSize: query.pageSize,
      total: total[0].total,
      entries: entries.map(toEntry),
      me: me[0] ? toEntry(me[0]) : null,
    };
  }
}
