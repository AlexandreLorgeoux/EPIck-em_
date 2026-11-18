import { IsIn } from 'class-validator';

export const SEEDING_MODES = ['manual', 'auto'] as const;

export class GenerateBracketDto {
  // manual: use the seeds set with PUT /seeding; auto: random seeds
  @IsIn(SEEDING_MODES, { message: 'seeding must be manual or auto' })
  seeding: (typeof SEEDING_MODES)[number];
}
