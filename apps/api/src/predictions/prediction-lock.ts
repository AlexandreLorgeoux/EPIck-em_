// Whether a match still takes predictions. Pure, so the rule is tested on
// its own; the time is the server's, passed in, never the browser's.

export type LockReason = 'bye' | 'teams-unknown' | 'started' | 'played';

export interface LockableMatch {
  // Planned start; null until the admin schedules it
  scheduledAt: Date | null;
  // The match has a result (any version)
  played: boolean;
  // State of each slot: open (team not known), assigned or bye
  slots: ('open' | 'assigned' | 'bye')[];
}

// Null while predictions are open, otherwise why they are not
export function predictionLock(
  match: LockableMatch,
  now: Date,
): LockReason | null {
  if (match.slots.includes('bye')) return 'bye';
  if (match.played) return 'played';
  if (match.scheduledAt && match.scheduledAt.getTime() <= now.getTime()) {
    return 'started';
  }
  if (match.slots.some((state) => state !== 'assigned')) return 'teams-unknown';
  return null;
}
