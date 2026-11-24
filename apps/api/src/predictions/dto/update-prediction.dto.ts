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
import { SCORE_SHAPE } from './create-prediction.dto.js';

// Every field is optional; score: null removes the exact score (IsOptional
// lets null through)
export class UpdatePredictionDto {
  @IsOptional()
  @IsUUID('all', { message: 'teamId must be a valid UUID' })
  teamId?: string;

  @IsOptional()
  @IsArray({ message: SCORE_SHAPE })
  @ArrayMinSize(2, { message: SCORE_SHAPE })
  @ArrayMaxSize(2, { message: SCORE_SHAPE })
  @IsInt({ each: true, message: 'each score must be a whole number' })
  @Min(0, { each: true, message: 'each score must be 0 or more' })
  @Max(1000, { each: true, message: 'each score must be 1000 or less' })
  score?: number[] | null;
}
