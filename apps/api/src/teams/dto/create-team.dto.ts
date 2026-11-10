import { IsOptional, IsString, Length } from 'class-validator';
import { Trim } from '../../common/trim.js';

export class CreateTeamDto {
  @Trim()
  @IsString({ message: 'name must be a string' })
  @Length(2, 64, { message: 'name must be between 2 and 64 characters' })
  name: string;

  @IsOptional()
  @Trim()
  @IsString({ message: 'tag must be a string' })
  @Length(1, 8, { message: 'tag must be between 1 and 8 characters' })
  tag?: string;
}
