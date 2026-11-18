import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';

const SCORES_SHAPE = 'scores must be two scores, slot 1 first';

// Score of a played match, as the admin reads it from the game
export class RecordResultDto {
  @IsArray({ message: SCORES_SHAPE })
  @ArrayMinSize(2, { message: SCORES_SHAPE })
  @ArrayMaxSize(2, { message: SCORES_SHAPE })
  @IsInt({ each: true, message: 'each score must be a whole number' })
  @Min(0, { each: true, message: 'each score must be 0 or more' })
  @Max(1_000_000, { each: true, message: 'each score must be 1000000 or less' })
  scores: number[];

  // Checked against the scores, to catch a score typed the wrong way round
  @IsIn([1, 2], { message: 'winnerSlot must be 1 or 2' })
  winnerSlot: 1 | 2;
}
