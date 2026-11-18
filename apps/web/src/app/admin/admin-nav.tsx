"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";

const sections = [
  { href: routes.admin.home, label: "Accueil" },
  { href: routes.admin.tournaments, label: "Tournois" },
  { href: routes.admin.teams, label: "Équipes" },
  { href: routes.admin.players, label: "Joueurs" },
];

// The section a path belongs to: /admin/teams/42 is in "Équipes"
const isCurrent = (href: string, path: string) =>
  href === routes.admin.home
    ? path === href
    : path === href || path.startsWith(`${href}/`);

export function NavLinks({ current }: { current: string | null }) {
  return (
    <nav aria-label="Administration" className="mx-auto max-w-5xl px-4">
      <ul className="flex flex-wrap gap-x-6">
        {sections.map(({ href, label }) => {
          const active = current !== null && isCurrent(href, current);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // The current section is marked by a thick underline and
                // aria-current, not by a color
                className={`inline-flex min-h-11 items-center border-b-4 ${
                  active ? "border-current font-bold" : "border-transparent"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminNav() {
  return <NavLinks current={usePathname()} />;
}
