import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class LeaderboardQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page must be 1 or more' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be a whole number' })
  @Min(1, { message: 'pageSize must be 1 or more' })
  @Max(100, { message: 'pageSize must be 100 or less' })
  pageSize: number = 20;
}
