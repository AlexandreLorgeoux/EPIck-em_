import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Trim } from '../../common/trim.js';

export class UpdateTeamDto {
  @IsOptional()
  @Trim()
  @IsString({ message: 'name must be a string' })
  @Length(2, 64, { message: 'name must be between 2 and 64 characters' })
  name?: string;

  // null removes the tag
  @IsOptional()
  @Trim()
  @IsString({ message: 'tag must be a string or null' })
  @Length(1, 8, { message: 'tag must be between 1 and 8 characters' })
  tag?: string | null;

  // Must be a current member of the team; null removes the captain
  @IsOptional()
  @IsUUID('all', { message: 'captainPlayerId must be a valid UUID or null' })
  captainPlayerId?: string | null;
}
