import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const SCORE_SHAPE = 'score must be two scores, slot 1 first';

export class CreatePredictionDto {
  @IsUUID('all', { message: 'matchId must be a valid UUID' })
  matchId: string;

  // The team predicted to win, one of the two teams of the match
  @IsUUID('all', { message: 'teamId must be a valid UUID' })
  teamId: string;

  // Optional exact score, in slot order like results
  @IsOptional()
  @IsArray({ message: SCORE_SHAPE })
  @ArrayMinSize(2, { message: SCORE_SHAPE })
  @ArrayMaxSize(2, { message: SCORE_SHAPE })
  @IsInt({ each: true, message: 'each score must be a whole number' })
  @Min(0, { each: true, message: 'each score must be 0 or more' })
  @Max(1000, { each: true, message: 'each score must be 1000 or less' })
  score?: number[];
}
