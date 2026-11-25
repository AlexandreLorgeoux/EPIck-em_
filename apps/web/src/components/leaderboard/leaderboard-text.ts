import type { Leaderboard, LeaderboardEntry } from "@/lib/api/models";
import { pointsText } from "@/components/predictions/prediction-text";

// "1er", "2e"
export const rankText = (rank: number) => (rank === 1 ? "1er" : `${rank}e`);

const placeText = ({ rank, points }: LeaderboardEntry) =>
  `Tu es ${rankText(rank)} avec ${pointsText(points)}.`;

/**
 * One sentence about what changed in the ranking since it was last said;
 * empty when nothing a listener cares about did.
 */
export function announceLeaderboard(
  before: Leaderboard,
  after: Leaderboard,
): string {
  const summary = ({ entries, me }: Leaderboard) =>
    JSON.stringify([
      me && [me.rank, me.points],
      entries.map((e) => [e.user.id, e.rank, e.points]),
    ]);
  if (summary(before) === summary(after)) return "";
  if (after.me) return `Classement mis à jour. ${placeText(after.me)}`;
  const first = after.entries.find((e) => e.rank === 1);
  return first
    ? `Classement mis à jour. ${first.user.displayName} est en tête avec ${pointsText(first.points)}.`
    : "Classement mis à jour.";
}
