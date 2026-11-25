import Link from "next/link";
import { routes } from "@/lib/routes";

// The pages of a public tournament; the one being read is marked in words
// for screen readers (aria-current) and by a thick line
export function TournamentNav({
  slug,
  current,
}: {
  slug: string;
  current: "matches" | "leaderboard";
}) {
  const pages = [
    { key: "matches", label: "Matchs", href: routes.tournament(slug) },
    {
      key: "leaderboard",
      label: "Classement",
      href: routes.leaderboard(slug),
    },
  ];
  return (
    <nav aria-label="Tournoi">
      <ul className="flex flex-wrap gap-x-6">
        {pages.map(({ key, label, href }) => (
          <li key={key}>
            <Link
              href={href}
              aria-current={key === current ? "page" : undefined}
              className={`label inline-flex min-h-11 items-center border-b-4 text-ink no-underline ${
                key === current ? "border-brand" : "border-transparent"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
