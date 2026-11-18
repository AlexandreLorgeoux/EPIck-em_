import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { firstFreeSlug, slugify } from '../common/slug.js';
import { fieldException } from '../common/validation-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTournamentDto } from './dto/create-tournament.dto.js';
import { ListTournamentsQuery } from './dto/list-tournaments.query.js';
import { UpdateTournamentDto } from './dto/update-tournament.dto.js';
import {
  tournamentStatus,
  type MatchProgress,
  type TournamentStatus,
} from './tournament-status.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const withRelations = {
  game: { select: { id: true, name: true } },
  owner: { select: { id: true, displayName: true } },
} as const;

type TournamentRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
  lifecycle: 'draft' | 'published' | 'archived';
  game: { id: string; name: string };
  owner: { id: string; displayName: string };
};

const toResponse = (row: TournamentRow, progress?: MatchProgress) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  game: row.game,
  description: row.description,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  timezone: row.timezone,
  status: tournamentStatus(row.lifecycle, progress),
  owner: row.owner,
});

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTournamentDto, owner: AuthUser) {
    const startsAt = toDate(dto.startsAt) ?? null;
    const endsAt = toDate(dto.endsAt) ?? null;
    this.assertDates(startsAt, endsAt);
    const game = await this.findOrCreateGame(dto.game);
    const row = await this.prisma.tournament.create({
      data: {
        name: dto.name,
        slug: await this.freeSlug(dto.name),
        description: dto.description,
        startsAt,
        endsAt,
        gameId: game.id,
        ownerUserId: owner.id,
      },
      include: withRelations,
    });
    return toResponse(row);
  }

  // Drafts are only listed for admins
  async findAll(query: ListTournamentsQuery, user?: AuthUser) {
    const rows = await this.prisma.tournament.findMany({
      where: user?.role === 'admin' ? {} : { lifecycle: { not: 'draft' } },
      include: withRelations,
      orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    });
    const progress = await this.matchProgress(rows.map((r) => r.id));
    return rows
      .map((row) => toResponse(row, progress.get(row.id)))
      .filter((t) => !query.status || t.status === query.status);
  }

  // By id or by slug (the public page uses the slug). A draft is not found
  // for anyone but admins, so its existence is not revealed.
  async findOne(idOrSlug: string, user?: AuthUser) {
    const row = await this.prisma.tournament.findUnique({
      where: UUID.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      include: withRelations,
    });
    if (!row || (row.lifecycle === 'draft' && user?.role !== 'admin')) {
      throw new NotFoundException(`No tournament ${idOrSlug}`);
    }
    const progress = await this.matchProgress([row.id]);
    return toResponse(row, progress.get(row.id));
  }

  async update(id: string, dto: UpdateTournamentDto) {
    const current = await this.getDraft(id, 'edited');
    const startsAt = toDate(dto.startsAt);
    const endsAt = toDate(dto.endsAt);
    this.assertDates(
      startsAt === undefined ? current.startsAt : startsAt,
      endsAt === undefined ? current.endsAt : endsAt,
    );
    const renamed = dto.name !== undefined && dto.name !== current.name;
    const row = await this.prisma.tournament.update({
      where: { id },
      data: {
        name: dto.name,
        // A draft is not public yet: its URL can follow the new name
        slug: renamed ? await this.freeSlug(dto.name!, id) : undefined,
        description: dto.description,
        startsAt,
        endsAt,
        gameId: dto.game
          ? (await this.findOrCreateGame(dto.game)).id
          : undefined,
      },
      include: withRelations,
    });
    return toResponse(row);
  }

  async remove(id: string) {
    await this.getDraft(id, 'deleted');
    // A draft has no results yet, only its setup to remove with it
    await this.prisma.$transaction([
      this.prisma.matchSlot.deleteMany({
        where: { match: { stage: { tournamentId: id } } },
      }),
      this.prisma.match.deleteMany({ where: { stage: { tournamentId: id } } }),
      this.prisma.registration.deleteMany({ where: { tournamentId: id } }),
      this.prisma.stage.deleteMany({ where: { tournamentId: id } }),
      this.prisma.tournament.delete({ where: { id } }),
    ]);
  }

  // Draft to running: the tournament becomes public and can no longer be
  // edited or deleted
  async start(id: string) {
    await this.getDraft(id, 'started');
    const row = await this.prisma.tournament.update({
      where: { id },
      data: { lifecycle: 'published' },
      include: withRelations,
    });
    return toResponse(row);
  }

  // The tournament, if it is still a draft. Editing, deleting and changing
  // the teams are only allowed then.
  async getDraft(id: string, action: string) {
    const row = await this.prisma.tournament.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`No tournament ${id}`);
    const progress = await this.matchProgress([id]);
    const status: TournamentStatus = tournamentStatus(
      row.lifecycle,
      progress.get(id),
    );
    if (status !== 'draft') {
      throw new ConflictException(
        `This tournament is ${status}: only a draft tournament can be ${action}`,
      );
    }
    return row;
  }

  private assertDates(startsAt: Date | null, endsAt: Date | null) {
    if (startsAt && endsAt && endsAt < startsAt) {
      throw fieldException('endsAt', 'endsAt must be after startsAt');
    }
  }

  // Games are named by organizers: the same name, whatever its case or
  // accents, is the same game
  private findOrCreateGame(name: string) {
    const slug = slugify(name) || 'game';
    return this.prisma.game.upsert({
      where: { slug },
      update: {},
      // Team game by default; game rules get their own screen later
      create: { slug, name, participantKind: 'team', maxTeamSize: 5 },
    });
  }

  private async freeSlug(name: string, exceptId?: string) {
    const base = slugify(name) || 'tournament';
    const taken = await this.prisma.tournament.findMany({
      where: {
        slug: { startsWith: base },
        NOT: exceptId ? { id: exceptId } : undefined,
      },
      select: { slug: true },
    });
    return firstFreeSlug(
      base,
      taken.map((t) => t.slug),
    );
  }

  // Matches played and in total per tournament, from the derived bracket
  private async matchProgress(ids: string[]) {
    const progress = new Map<string, MatchProgress>();
    if (!ids.length) return progress;
    const rows = await this.prisma.$queryRaw<
      { tournament_id: string; total: bigint; decided: bigint }[]
    >`
      SELECT s.tournament_id,
             count(m.id) AS total,
             count(o.match_id) FILTER (WHERE o.state = 'decided') AS decided
      FROM stage s
      JOIN match m ON m.stage_id = s.id
      LEFT JOIN match_outcome o ON o.match_id = m.id
      WHERE s.tournament_id = ANY(${ids}::uuid[])
      GROUP BY s.tournament_id`;
    for (const row of rows) {
      progress.set(row.tournament_id, {
        total: Number(row.total),
        decided: Number(row.decided),
      });
    }
    return progress;
  }
}
