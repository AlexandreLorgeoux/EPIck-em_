import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { today } from '../common/dates.js';
import { byText } from '../common/sort.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';

// Current members only: ended memberships stay in the table as history
const withMembers = {
  members: {
    where: { leftOn: null },
    include: { player: { select: { id: true, handle: true } } },
    orderBy: { joinedOn: 'asc' },
  },
} as const;

type TeamWithMembers = {
  id: string;
  name: string;
  tag: string | null;
  captainPlayerId: string | null;
  members: {
    joinedOn: Date;
    isSubstitute: boolean;
    role: string | null;
    player: { id: string; handle: string };
  }[];
};

const toResponse = ({ members, ...team }: TeamWithMembers) => ({
  id: team.id,
  name: team.name,
  tag: team.tag,
  captainPlayerId: team.captainPlayerId,
  members: members.map((m) => ({
    ...m.player,
    isSubstitute: m.isSubstitute,
    role: m.role,
    joinedOn: m.joinedOn.toISOString().slice(0, 10),
  })),
});

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: dto,
      include: withMembers,
    });
    return toResponse(team);
  }

  async findAll(search?: string) {
    const teams = await this.prisma.team.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { tag: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: withMembers,
    });
    return teams.sort(byText((t) => t.name)).map(toResponse);
  }

  async findOne(id: string) {
    return toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateTeamDto) {
    const team = await this.getOrThrow(id);
    if (
      dto.captainPlayerId &&
      !team.members.some((m) => m.player.id === dto.captainPlayerId)
    ) {
      throw new BadRequestException(
        'captainPlayerId must be a current member of the team: add the player to the team first',
      );
    }
    const updated = await this.prisma.team.update({
      where: { id },
      data: dto,
      include: withMembers,
    });
    return toResponse(updated);
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    const registrations = await this.prisma.registration.count({
      where: { teamId: id },
    });
    if (registrations > 0) {
      throw new ConflictException(
        `This team is registered in ${registrations} tournament(s): withdraw the registrations before deleting the team`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.teamMember.deleteMany({ where: { teamId: id } }),
      this.prisma.team.delete({ where: { id } }),
    ]);
  }

  async addMember(teamId: string, dto: AddMemberDto) {
    await this.getOrThrow(teamId);
    const player = await this.prisma.player.findUnique({
      where: { id: dto.playerId },
    });
    if (!player) {
      throw new NotFoundException(`No player with id ${dto.playerId}`);
    }

    // A player belongs to one team at a time
    const current = await this.prisma.teamMember.findFirst({
      where: { playerId: dto.playerId, leftOn: null },
      include: { team: { select: { id: true, name: true } } },
    });
    if (current) {
      throw new ConflictException(
        current.team.id === teamId
          ? `${player.handle} is already a member of this team`
          : `${player.handle} already belongs to ${current.team.name}: remove them from that team first`,
      );
    }

    const fields = { isSubstitute: dto.isSubstitute ?? false, role: dto.role };
    const joinedOn = today();
    // Leaving and joining back on the same day reopens that membership,
    // since (team, player, joined_on) is the primary key
    await this.prisma.teamMember.upsert({
      where: {
        teamId_playerId_joinedOn: {
          teamId,
          playerId: dto.playerId,
          joinedOn,
        },
      },
      create: { teamId, playerId: dto.playerId, joinedOn, ...fields },
      update: { leftOn: null, ...fields },
    });
    return this.findOne(teamId);
  }

  async removeMember(teamId: string, playerId: string) {
    const team = await this.getOrThrow(teamId);
    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, playerId, leftOn: null },
    });
    if (!membership) {
      throw new NotFoundException(
        `Player ${playerId} is not a current member of this team`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.teamMember.update({
        where: {
          teamId_playerId_joinedOn: {
            teamId,
            playerId,
            joinedOn: membership.joinedOn,
          },
        },
        data: { leftOn: today() },
      }),
      ...(team.captainPlayerId === playerId
        ? [
            this.prisma.team.update({
              where: { id: teamId },
              data: { captainPlayerId: null },
            }),
          ]
        : []),
    ]);
    return this.findOne(teamId);
  }

  private async getOrThrow(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: withMembers,
    });
    if (!team) throw new NotFoundException(`No team with id ${id}`);
    return team;
  }
}
