import {
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim.js';

export class CreateTournamentDto {
  @Trim()
  @IsString({ message: 'name must be a string' })
  @Length(3, 80, { message: 'name must be between 3 and 80 characters' })
  name: string;

  // Name of the game; an unknown game is created
  @Trim()
  @IsString({ message: 'game must be a string' })
  @Length(2, 60, { message: 'game must be between 2 and 60 characters' })
  game: string;

  @IsOptional()
  @Trim()
  @IsString({ message: 'description must be a string' })
  @MaxLength(2000, { message: 'description must be at most 2000 characters' })
  description?: string;

  @IsOptional()
  @IsISO8601(
    {},
    { message: 'startsAt must be a date such as 2026-12-05T14:00:00Z' },
  )
  startsAt?: string;

  @IsOptional()
  @IsISO8601(
    {},
    { message: 'endsAt must be a date such as 2026-12-06T20:00:00Z' },
  )
  endsAt?: string;
}
