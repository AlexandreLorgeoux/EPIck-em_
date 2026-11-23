import type { TournamentStatus } from "@/lib/api/models";
import { Icon, type IconName } from "./brand/icon";

const badges: Record<
  TournamentStatus,
  { label: string; icon: IconName; variant: string }
> = {
  draft: { label: "Brouillon", icon: "lock", variant: "oc-badge--locked" },
  running: { label: "En cours", icon: "live", variant: "oc-badge--soon" },
  finished: { label: "Terminé", icon: "check", variant: "oc-badge--win" },
};

export const statusLabel = (status: TournamentStatus) => badges[status].label;

// Oracup StatusBadge: an icon and a word, never the color alone
export function StatusBadge({ status }: { status: TournamentStatus }) {
  const { label, icon, variant } = badges[status];
  return (
    <span className={`oc-badge ${variant}`}>
      <Icon name={icon} />
      {label}
    </span>
  );
}

// "5 déc. 2026, 15:00", or a dash when the date is not set
export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
