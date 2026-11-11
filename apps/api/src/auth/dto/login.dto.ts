import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password is required' })
  password: string;
}
