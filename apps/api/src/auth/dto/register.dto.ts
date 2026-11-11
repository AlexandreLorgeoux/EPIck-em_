import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { Trim } from '../../common/trim.js';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @Trim()
  @IsString({ message: 'displayName must be a string' })
  @Length(2, 32, { message: 'displayName must be between 2 and 32 characters' })
  displayName: string;

  // Length only, no composition rules (NIST SP 800-63B); never trimmed
  @IsString({ message: 'password must be a string' })
  @Length(8, 128, { message: 'password must be between 8 and 128 characters' })
  password: string;
}
