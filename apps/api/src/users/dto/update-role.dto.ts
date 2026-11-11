import { IsIn } from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class UpdateRoleDto {
  @IsIn(Object.values(UserRole), {
    message: `role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role: UserRole;
}
