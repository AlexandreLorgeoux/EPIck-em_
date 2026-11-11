import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Patch(':id/role')
  updateRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', uuidParam()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.users.updateRole(actor.id, id, dto);
  }
}
