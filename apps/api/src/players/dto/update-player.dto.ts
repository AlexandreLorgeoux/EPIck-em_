import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Trim } from '../../common/trim.js';

export class UpdatePlayerDto {
  @IsOptional()
  @Trim()
  @IsString({ message: 'handle must be a string' })
  @Length(2, 32, { message: 'handle must be between 2 and 32 characters' })
  handle?: string;

  // null unlinks the account
  @IsOptional()
  @IsUUID('all', { message: 'userId must be a valid UUID or null' })
  userId?: string | null;
}
