import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { byText } from '../common/sort.js';
import { fieldException } from '../common/validation-errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddTeamDto } from './dto/add-team.dto.js';
import { SetSeedingDto } from './dto/set-seeding.dto.js';
import { TournamentsService } from './tournaments.service.js';

// Registrations that take part in the bracket
export const ACTIVE_REGISTRATION: Prisma.RegistrationWhereInput = {
  status: { in: ['registered', 'checked_in'] },
};

type Entry = {
  seed: number | null;
  team: { id: string; name: string; tag: string | null } | null;
};

const toResponse = ({ seed, team }: Entry) => ({ ...team!, seed });

// Seeded teams first by seed, then the others by name
const bySeedThenName = (a: Entry, b: Entry) =>
  (a.seed ?? Infinity) - (b.seed ?? Infinity) ||
  byText<Entry>((e) => e.team!.name)(a, b);

@Injectable()
export class TournamentTeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentsService,
  ) {}

  async list(tournamentId: string, user?: AuthUser) {
    // Same visibility as the tournament itself
    await this.tournaments.findOne(tournamentId, user);
    return this.entries(tournamentId);
  }

  async add(tournamentId: string, dto: AddTeamDto) {
    await this.tournaments.getDraft(tournamentId, 'changed');
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });
    if (!team) throw fieldException('teamId', `No team with id ${dto.teamId}`);
    const existing = await this.prisma.registration.findUnique({
      where: {
        tournamentId_teamId: { tournamentId, teamId: dto.teamId },
      },
    });
    if (existing) {
      throw new ConflictException(`${team.name} is already in this tournament`);
    }
    await this.prisma.registration.create({
      data: { tournamentId, teamId: dto.teamId },
    });
    return this.entries(tournamentId);
  }

  async remove(tournamentId: string, teamId: string) {
    await this.tournaments.getDraft(tournamentId, 'changed');
    const { count } = await this.prisma.registration.deleteMany({
      where: { tournamentId, teamId },
    });
    if (!count) {
      throw new NotFoundException(`Team ${teamId} is not in this tournament`);
    }
  }

  // Manual seeding: the list gives every team of the tournament, seed 1
  // first, so no seed is left out or given twice
  async setSeeding(tournamentId: string, dto: SetSeedingDto) {
    await this.tournaments.getDraft(tournamentId, 'changed');
    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, ...ACTIVE_REGISTRATION },
      select: { id: true, teamId: true },
    });
    const registered = new Set(registrations.map((r) => r.teamId));
    const listed = new Set(dto.teamIds);
    const unknown = dto.teamIds.filter((id) => !registered.has(id));
    const missing = registrations.filter((r) => !listed.has(r.teamId!));
    if (unknown.length || missing.length) {
      throw fieldException(
        'teamIds',
        `teamIds must list every team of the tournament once: ${unknown.length} not in it, ${missing.length} missing`,
      );
    }
    await this.prisma.$transaction(
      dto.teamIds.map((teamId, index) =>
        this.prisma.registration.updateMany({
          where: { tournamentId, teamId },
          data: { seed: index + 1 },
        }),
      ),
    );
    return this.entries(tournamentId);
  }

  private async entries(tournamentId: string) {
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId, ...ACTIVE_REGISTRATION, teamId: { not: null } },
      select: {
        seed: true,
        team: { select: { id: true, name: true, tag: true } },
      },
    });
    return rows.sort(bySeedThenName).map(toResponse);
  }
}
