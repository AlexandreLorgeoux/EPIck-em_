import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { Trim } from '../../common/trim.js';

export class AddMemberDto {
  @IsUUID('all', { message: 'playerId must be a valid UUID' })
  playerId: string;

  @IsOptional()
  @IsBoolean({ message: 'isSubstitute must be true or false' })
  isSubstitute?: boolean;

  @IsOptional()
  @Trim()
  @IsString({ message: 'role must be a string' })
  @Length(1, 32, { message: 'role must be between 1 and 32 characters' })
  role?: string;
}
