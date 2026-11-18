import { IsUUID } from 'class-validator';

export class AddTeamDto {
  @IsUUID('all', { message: 'teamId must be a valid UUID' })
  teamId: string;
}
