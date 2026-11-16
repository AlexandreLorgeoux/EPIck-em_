import { IsIn, IsOptional } from 'class-validator';
import {
  TOURNAMENT_STATUSES,
  type TournamentStatus,
} from '../tournament-status.js';

export class ListTournamentsQuery {
  @IsOptional()
  @IsIn(TOURNAMENT_STATUSES, {
    message: `status must be one of: ${TOURNAMENT_STATUSES.join(', ')}`,
  })
  status?: TournamentStatus;
}
