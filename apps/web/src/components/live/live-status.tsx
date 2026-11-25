import { Icon } from "@/components/brand/icon";
import type { StreamStatus } from "@/lib/live/use-tournament-stream";

// Whether the page updates by itself, and the polite sentence about the
// last update. The regions stay in the page, so changes to them are said.
export function LiveStatus({
  status,
  announcement,
}: {
  status: StreamStatus;
  announcement: string;
}) {
  return (
    <div className="min-h-7">
      <p role="status">
        {status === "live" && (
          <span className="oc-badge oc-badge--live">
            <span className="oc-live__dot" aria-hidden="true" />
            {/* Not "overline": Tailwind draws a line for it */}
            <span className="uppercase">En direct</span>
          </span>
        )}
        {status === "lost" && (
          <span className="oc-badge oc-badge--locked whitespace-normal">
            <Icon name="info" />
            Connexion perdue : reconnexion en cours
          </span>
        )}
      </p>
      <p role="status" aria-label="Mises à jour" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
