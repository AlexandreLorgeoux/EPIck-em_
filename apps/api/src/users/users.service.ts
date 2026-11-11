import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService, publicUser } from '../auth/auth.service.js';
import { byText } from '../common/sort.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({ select: publicUser });
    return users.sort(byText((u) => u.displayName));
  }

  async updateRole(actorId: string, userId: string, dto: UpdateRoleDto) {
    // Keeps the platform from losing its last admin by mistake
    if (actorId === userId) {
      throw new BadRequestException(
        'You cannot change your own role: ask another admin',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`No user with id ${userId}`);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: publicUser,
    });
    // Old sessions carry the old role: sign the user out everywhere
    if (user.role !== dto.role) await this.auth.revokeAllSessions(userId);
    return updated;
  }
}
