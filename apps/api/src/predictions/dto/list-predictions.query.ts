import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListPredictionsQuery {
  // A tournament id or slug, to list one tournament only
  @IsOptional()
  @IsString({ message: 'tournament must be a tournament id or slug' })
  @MaxLength(200, { message: 'tournament must be at most 200 characters' })
  tournament?: string;
}
