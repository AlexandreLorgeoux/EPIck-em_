import type { TournamentStatus } from "@/lib/api/models";

const labels: Record<TournamentStatus, string> = {
  draft: "Brouillon",
  running: "En cours",
  finished: "Terminé",
};

// Border styles only tell the statuses apart at a glance: the word is what
// says the status, so it reads the same without colors
const styles: Record<TournamentStatus, string> = {
  draft: "border-dashed",
  running: "border-solid",
  finished: "border-double border-4",
};

export const statusLabel = (status: TournamentStatus) => labels[status];

export function StatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span
      className={`inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold ${styles[status]}`}
    >
      {labels[status]}
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
