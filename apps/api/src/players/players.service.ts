import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { byText } from '../common/sort.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePlayerDto } from './dto/create-player.dto.js';
import { UpdatePlayerDto } from './dto/update-player.dto.js';

// A player's team is its membership that has not ended
const withCurrentTeam = {
  memberships: {
    where: { leftOn: null },
    include: { team: { select: { id: true, name: true, tag: true } } },
  },
} as const;

type PlayerWithTeam = {
  id: string;
  handle: string;
  userId: string | null;
  memberships: {
    isSubstitute: boolean;
    role: string | null;
    team: { id: string; name: string; tag: string | null };
  }[];
};

const toResponse = ({ memberships, ...player }: PlayerWithTeam) => {
  const membership = memberships[0];
  return {
    ...player,
    team: membership
      ? {
          ...membership.team,
          isSubstitute: membership.isSubstitute,
          role: membership.role,
        }
      : null,
  };
};

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlayerDto) {
    if (dto.userId) await this.assertUserExists(dto.userId);
    const player = await this.prisma.player.create({
      data: dto,
      include: withCurrentTeam,
    });
    return toResponse(player);
  }

  async findAll(search?: string) {
    const players = await this.prisma.player.findMany({
      where: search
        ? { handle: { contains: search, mode: 'insensitive' } }
        : undefined,
      include: withCurrentTeam,
    });
    return players.sort(byText((p) => p.handle)).map(toResponse);
  }

  async findOne(id: string) {
    return toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdatePlayerDto) {
    await this.getOrThrow(id);
    if (dto.userId) await this.assertUserExists(dto.userId);
    const player = await this.prisma.player.update({
      where: { id },
      data: dto,
      include: withCurrentTeam,
    });
    return toResponse(player);
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    const registrations = await this.prisma.registration.count({
      where: { playerId: id },
    });
    if (registrations > 0) {
      throw new ConflictException(
        `This player is registered in ${registrations} tournament(s): withdraw the registrations before deleting the player`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.team.updateMany({
        where: { captainPlayerId: id },
        data: { captainPlayerId: null },
      }),
      this.prisma.teamMember.deleteMany({ where: { playerId: id } }),
      this.prisma.player.delete({ where: { id } }),
    ]);
  }

  private async getOrThrow(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: withCurrentTeam,
    });
    if (!player) throw new NotFoundException(`No player with id ${id}`);
    return player;
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException(`userId ${userId} does not match any user`);
    }
  }
}
