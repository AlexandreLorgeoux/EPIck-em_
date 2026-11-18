import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

// Manual seeding: every team of the tournament, best first
export class SetSeedingDto {
  @IsArray({ message: 'teamIds must be a list of team ids, best seed first' })
  @ArrayUnique({ message: 'teamIds must not list a team twice' })
  @IsUUID('all', { each: true, message: 'each teamId must be a valid UUID' })
  teamIds: string[];
}
