import { IsInt, Max, Min } from 'class-validator';

const points = (field: string) => ({
  int: { message: `${field} must be a whole number of points` },
  min: { message: `${field} must be 0 or more` },
  max: { message: `${field} must be 100 or less` },
});

// The points of a tournament's predictions (docs/database-schema.md)
export class SetScoringDto {
  @IsInt(points('pointsCorrectPick').int)
  @Min(0, points('pointsCorrectPick').min)
  @Max(100, points('pointsCorrectPick').max)
  pointsCorrectPick: number;

  @IsInt(points('exactScoreBonus').int)
  @Min(0, points('exactScoreBonus').min)
  @Max(100, points('exactScoreBonus').max)
  exactScoreBonus: number;

  @IsInt(points('roundIncrement').int)
  @Min(0, points('roundIncrement').min)
  @Max(100, points('roundIncrement').max)
  roundIncrement: number;
}
