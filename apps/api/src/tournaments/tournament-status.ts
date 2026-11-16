import type { TournamentLifecycle } from '../generated/prisma/enums.js';

export const TOURNAMENT_STATUSES = ['draft', 'running', 'finished'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export interface MatchProgress {
  total: number;
  decided: number;
}

// Only the lifecycle is stored. Whether a started tournament is still
// running or finished is derived from its matches (docs/data-model.md):
// finished once it has matches and every one of them is decided.
export function tournamentStatus(
  lifecycle: TournamentLifecycle,
  progress: MatchProgress = { total: 0, decided: 0 },
): TournamentStatus {
  if (lifecycle === 'draft') return 'draft';
  if (lifecycle === 'archived') return 'finished';
  return progress.total > 0 && progress.decided === progress.total
    ? 'finished'
    : 'running';
}
